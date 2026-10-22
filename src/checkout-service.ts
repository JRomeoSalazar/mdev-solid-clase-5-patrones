import { PaymentsGatewayV1, type LegacyPaymentRequest } from './legacy/payments-gateway-v1.ts'
import { Order } from './order.ts'
import {
  analyticsService,
  emailService,
  inventoryService,
  loyaltyService,
  warehouseService,
} from './notifications/side-effects.ts'
import type { CheckoutRequest, CheckoutResult, TicketType } from './types.ts'

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

const BASE_PRICES: Record<TicketType, number> = {
  general: 30,
  vip: 90,
  'early-bird': 20,
}

export class CheckoutService {
  private readonly options: CheckoutOptions
  private readonly responseCache = new Map<string, CheckoutResult>()
  readonly logLines: string[] = []

  constructor(
    private readonly gateway: PaymentsGatewayV1 = new PaymentsGatewayV1(),
    options: Partial<CheckoutOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  checkout(request: CheckoutRequest): CheckoutResult {
    if (this.options.withCache) {
      const cached = this.responseCache.get(request.orderId)
      if (cached) {
        if (this.options.withLogging) this.logLines.push(`[cache] hit ${request.orderId}`)
        return cached
      }
    }
    if (this.options.withLogging) {
      this.logLines.push(`[checkout] inicio ${request.orderId} (${request.paymentMethod})`)
    }

    // ---------- Validaciones ----------
    if (!request.customerEmail.includes('@')) {
      throw new Error(`Email inválido: ${request.customerEmail}`)
    }
    if (request.quantity <= 0) {
      throw new Error('Hay que comprar al menos una entrada')
    }
    if (request.quantity > 10) {
      throw new Error('No se pueden comprar más de 10 entradas en un mismo pedido')
    }
    if (request.discountPercentage < 0 || request.discountPercentage > 100) {
      throw new Error('El descuento debe estar entre 0 y 100')
    }
    if (request.ticketType === 'vip' && request.quantity > 4) {
      throw new Error('Máximo 4 entradas VIP por pedido')
    }
    if (request.isGift && request.quantity > 1) {
      throw new Error('Los pedidos de regalo solo admiten una entrada')
    }
    if (request.paymentMethod === 'card' && !request.cardToken) {
      throw new Error('Falta el token de la tarjeta')
    }
    if (request.paymentMethod === 'wallet' && !request.walletAccountId) {
      throw new Error('Falta la cuenta del monedero')
    }
    if (request.paymentMethod === 'voucher' && !request.voucherCode) {
      throw new Error('Falta el código del bono')
    }

    // ---------- Importe ----------
    const basePrice = BASE_PRICES[request.ticketType]
    const gross = basePrice * request.quantity
    const discounted = gross - (gross * request.discountPercentage) / 100

    const order = new Order(request.orderId)
    order.reserve()

    // ---------- Cobro ----------
    let amountCharged = 0
    let authorizationCode: string | null = null
    let message = ''

    switch (request.paymentMethod) {
      case 'card': {
        const fee = discounted * 0.015
        amountCharged = Math.round((discounted + fee) * 100) / 100
        const response = this.callGateway({
          AMOUNT_IN_CENTS: Math.round(amountCharged * 100),
          CURRENCY_CODE: 'EUR',
          OPERATION: 'SALE',
          CARD_TOKEN: request.cardToken ?? undefined,
          META: `order=${request.orderId};event=${request.eventId};qty=${request.quantity}`,
        })
        if (response.RESULT_CODE !== '00') {
          order.cancel()
          return {
            orderId: request.orderId,
            status: order.status,
            amountCharged: 0,
            authorizationCode: null,
            message: this.translateGatewayCode(response.RESULT_CODE),
          }
        }
        authorizationCode = response.AUTH_CODE ?? null
        message = 'Pago con tarjeta aceptado'
        break
      }

      case 'wallet': {
        amountCharged = Math.round(discounted * 100) / 100
        const response = this.callGateway({
          AMOUNT_IN_CENTS: Math.round(amountCharged * 100),
          CURRENCY_CODE: 'EUR',
          OPERATION: 'SALE',
          ACCOUNT_ID: request.walletAccountId ?? undefined,
          META: `order=${request.orderId};event=${request.eventId};qty=${request.quantity}`,
        })
        if (response.RESULT_CODE !== '00') {
          order.cancel()
          return {
            orderId: request.orderId,
            status: order.status,
            amountCharged: 0,
            authorizationCode: null,
            message: this.translateGatewayCode(response.RESULT_CODE),
          }
        }
        authorizationCode = response.AUTH_CODE ?? null
        message = 'Pago con monedero aceptado'
        break
      }

      case 'transfer': {
        amountCharged = Math.round(discounted * 100) / 100
        authorizationCode = null
        message = 'Transferencia pendiente de confirmación bancaria'
        break
      }

      case 'voucher': {
        amountCharged = 0
        authorizationCode = `VOUCHER-${request.voucherCode}`
        message = 'Pedido cubierto íntegramente con un bono'
        break
      }
    }

    order.markPaid()
    order.issueTickets()

    // ---------- Avisar a todo el mundo ----------
    emailService.sendPurchaseConfirmation(request.customerEmail, request.orderId)
    analyticsService.track('ticket_purchased', {
      orderId: request.orderId,
      eventId: request.eventId,
      amount: amountCharged,
      method: request.paymentMethod,
    })
    inventoryService.release(request.eventId, request.quantity)
    loyaltyService.award(request.customerEmail, Math.floor(amountCharged))
    warehouseService.schedulePrinting(request.orderId, request.quantity)

    if (this.options.withLogging) {
      this.logLines.push(`[checkout] fin ${request.orderId} -> ${order.status} (${amountCharged} EUR)`)
    }

    const result: CheckoutResult = {
      orderId: request.orderId,
      status: order.status,
      amountCharged,
      authorizationCode,
      message,
    }

    if (this.options.withCache) {
      this.responseCache.set(request.orderId, result)
    }

    return result
  }

  private callGateway(legacyRequest: LegacyPaymentRequest) {
    if (this.options.withLogging) {
      this.logLines.push(`[gateway] ${legacyRequest.OPERATION} ${legacyRequest.AMOUNT_IN_CENTS}`)
    }

    if (!this.options.withRetry) {
      return this.gateway.execute(legacyRequest)
    }

    let lastResponse = this.gateway.execute(legacyRequest)
    let attempt = 1
    while (lastResponse.RESULT_CODE === '99' && attempt < this.options.retryAttempts) {
      attempt += 1
      if (this.options.withLogging) {
        this.logLines.push(`[gateway] reintento ${attempt}`)
      }
      lastResponse = this.gateway.execute(legacyRequest)
    }
    return lastResponse
  }

  private translateGatewayCode(code: string): string {
    if (code === '05') return 'Tarjeta rechazada por el banco emisor'
    if (code === '51') return 'Fondos insuficientes'
    if (code === '99') return 'La pasarela de pago no responde'
    return 'Error desconocido en la pasarela'
  }
}

/**
 * Construye una petición de compra.
 */
export function createCheckoutRequest(
  orderId: string,
  eventId: string,
  customerEmail: string,
  customerName: string,
  ticketType: TicketType,
  quantity: number,
  paymentMethod: CheckoutRequest['paymentMethod'],
  cardToken: string | null,
  walletAccountId: string | null,
  voucherCode: string | null,
  discountPercentage: number,
  isGift: boolean,
  giftMessage: string | null,
  marketingOptIn: boolean,
): CheckoutRequest {
  return {
    orderId,
    eventId,
    customerEmail,
    customerName,
    ticketType,
    quantity,
    paymentMethod,
    cardToken,
    walletAccountId,
    voucherCode,
    discountPercentage,
    isGift,
    giftMessage,
    marketingOptIn,
  }
}
