import type { LegacyPaymentRequest, LegacyPaymentResponse } from './legacy/payments-gateway-v1.ts'
import type { CheckoutRequest, CheckoutResult } from './types.ts'

export type Gateway = (request: LegacyPaymentRequest) => LegacyPaymentResponse
export type CheckoutFn = (request: CheckoutRequest) => CheckoutResult
export type Decorator<F> = (next: F) => F

const GATEWAY_UNAVAILABLE = '99'
const CACHEABLE_STATUS = 'issued'

/** Wraps `base` with each decorator in order: the last one ends up outermost. */
export const pipe = <F>(base: F, ...decorators: Decorator<F>[]): F =>
  decorators.reduce((fn, decorate) => decorate(fn), base)

/** Applies `decorator` only when `enabled`, so option flags choose the composition. */
export const when = <F>(enabled: boolean, decorator: Decorator<F>): Decorator<F> =>
  enabled ? decorator : (fn) => fn

export const withGatewayLogging =
  (log: (line: string) => void): Decorator<Gateway> =>
  (next) =>
  (request) => {
    log(`[gateway] ${request.OPERATION} ${request.AMOUNT_IN_CENTS}`)
    return next(request)
  }

export const withRetry =
  (attempts: number, onRetry: (attempt: number) => void): Decorator<Gateway> =>
  (next) =>
  (request) => {
    let response = next(request)
    for (let attempt = 2; response.RESULT_CODE === GATEWAY_UNAVAILABLE && attempt <= attempts; attempt++) {
      onRetry(attempt)
      response = next(request)
    }
    return response
  }

export const withCheckoutLogging =
  (log: (line: string) => void): Decorator<CheckoutFn> =>
  (next) =>
  (request) => {
    log(`[checkout] inicio ${request.orderId} (${request.paymentMethod})`)
    const result = next(request)
    log(`[checkout] fin ${request.orderId} -> ${result.status} (${result.amountCharged} EUR)`)
    return result
  }

/** Only completed purchases are cached: a rejected payment can be retried. */
export const withCache =
  (cache: Map<string, CheckoutResult>, onHit: (orderId: string) => void): Decorator<CheckoutFn> =>
  (next) =>
  (request) => {
    const cached = cache.get(request.orderId)
    if (cached) {
      onHit(request.orderId)
      return cached
    }
    const result = next(request)
    if (result.status === CACHEABLE_STATUS) cache.set(request.orderId, result)
    return result
  }
