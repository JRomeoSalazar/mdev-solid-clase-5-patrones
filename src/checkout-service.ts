import {
  pipe,
  when,
  withCache,
  withCheckoutLogging,
  withGatewayLogging,
  withRetry,
  type CheckoutFn,
  type Gateway,
} from './decorators.ts'
import { PaymentsGatewayV1 } from './legacy/payments-gateway-v1.ts'
import { Order } from './order.ts'
import { paymentMethods } from './payment-methods.ts'
import { discountedTotal } from './pricing.ts'
import { purchaseListeners, type PurchaseListener } from './purchase-listeners.ts'
import type { CheckoutRequest, CheckoutResult } from './types.ts'
import { validateRequest } from './validation.ts'

export interface CheckoutOptions {
  withLogging: boolean
  withRetry: boolean
  retryAttempts: number
  withCache: boolean
}

const DEFAULT_OPTIONS: CheckoutOptions = {
  withLogging: false,
  withRetry: false,
  retryAttempts: 1,
  withCache: false,
}

export class CheckoutService {
  readonly logLines: string[] = []
  readonly checkout: CheckoutFn
  private readonly callGateway: Gateway

  constructor(
    gateway: PaymentsGatewayV1 = new PaymentsGatewayV1(),
    options: Partial<CheckoutOptions> = {},
    private readonly listeners: PurchaseListener[] = purchaseListeners,
  ) {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const log = (line: string) => {
      this.logLines.push(line)
    }

    this.callGateway = pipe<Gateway>(
      (request) => gateway.execute(request),
      when(opts.withRetry, withRetry(opts.retryAttempts, (attempt) => log(`[gateway] reintento ${attempt}`))),
      when(opts.withLogging, withGatewayLogging(log)),
    )
    this.checkout = pipe<CheckoutFn>(
      (request) => this.processCheckout(request),
      when(opts.withLogging, withCheckoutLogging(log)),
      when(opts.withCache, withCache(new Map(), (orderId) => opts.withLogging && log(`[cache] hit ${orderId}`))),
    )
  }

  private processCheckout(request: CheckoutRequest): CheckoutResult {
    validateRequest(request)

    const order = new Order(request.orderId)
    order.reserve()

    const outcome = paymentMethods[request.paymentMethod].charge(
      request,
      discountedTotal(request),
      this.callGateway,
    )
    if (!outcome.accepted) {
      order.cancel()
      return {
        orderId: request.orderId,
        status: order.status,
        amountCharged: 0,
        authorizationCode: null,
        message: outcome.message,
      }
    }

    order.markPaid()
    order.issueTickets()
    this.listeners.forEach((notify) => notify({ request, amountCharged: outcome.amountCharged }))

    return {
      orderId: request.orderId,
      status: order.status,
      amountCharged: outcome.amountCharged,
      authorizationCode: outcome.authorizationCode,
      message: outcome.message,
    }
  }
}
