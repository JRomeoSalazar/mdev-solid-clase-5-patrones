import type { LegacyPaymentRequest } from './legacy/payments-gateway-v1.ts'
import type { Gateway } from './decorators.ts'
import type { CheckoutRequest, PaymentMethod } from './types.ts'

export type ChargeOutcome =
  | { accepted: true; amountCharged: number; authorizationCode: string | null; message: string }
  | { accepted: false; message: string }

export interface PaymentMethodHandler {
  /** Returns an error message, or null when the request is valid for this method. */
  validate: (request: CheckoutRequest) => string | null
  charge: (request: CheckoutRequest, discounted: number, gateway: Gateway) => ChargeOutcome
}

const CARD_FEE_RATE = 0.015
const CURRENCY = 'EUR'
const GATEWAY_OK = '00'
const UNKNOWN_GATEWAY_ERROR = 'Error desconocido en la pasarela'
const GATEWAY_ERRORS: Record<string, string> = {
  '05': 'Tarjeta rechazada por el banco emisor',
  '51': 'Fondos insuficientes',
  '99': 'La pasarela de pago no responde',
}

const roundCents = (amount: number): number => Math.round(amount * 100) / 100

const requires =
  (field: 'cardToken' | 'walletAccountId' | 'voucherCode', message: string) =>
  (request: CheckoutRequest): string | null =>
    request[field] ? null : message

/** The only place that translates a checkout into the legacy gateway format. */
function chargeThroughGateway(
  feeRate: number,
  credentials: (request: CheckoutRequest) => Partial<LegacyPaymentRequest>,
  successMessage: string,
): PaymentMethodHandler['charge'] {
  return (request, discounted, gateway) => {
    const amountCharged = roundCents(discounted + discounted * feeRate)
    const response = gateway({
      AMOUNT_IN_CENTS: Math.round(amountCharged * 100),
      CURRENCY_CODE: CURRENCY,
      OPERATION: 'SALE',
      ...credentials(request),
      META: `order=${request.orderId};event=${request.eventId};qty=${request.quantity}`,
    })
    if (response.RESULT_CODE !== GATEWAY_OK) {
      return { accepted: false, message: GATEWAY_ERRORS[response.RESULT_CODE] ?? UNKNOWN_GATEWAY_ERROR }
    }
    return {
      accepted: true,
      amountCharged,
      authorizationCode: response.AUTH_CODE ?? null,
      message: successMessage,
    }
  }
}

export const paymentMethods: Record<PaymentMethod, PaymentMethodHandler> = {
  card: {
    validate: requires('cardToken', 'Falta el token de la tarjeta'),
    charge: chargeThroughGateway(
      CARD_FEE_RATE,
      (request) => ({ CARD_TOKEN: request.cardToken ?? undefined }),
      'Pago con tarjeta aceptado',
    ),
  },
  wallet: {
    validate: requires('walletAccountId', 'Falta la cuenta del monedero'),
    charge: chargeThroughGateway(
      0,
      (request) => ({ ACCOUNT_ID: request.walletAccountId ?? undefined }),
      'Pago con monedero aceptado',
    ),
  },
  transfer: {
    validate: () => null,
    charge: (_request, discounted) => ({
      accepted: true,
      amountCharged: roundCents(discounted),
      authorizationCode: null,
      message: 'Transferencia pendiente de confirmación bancaria',
    }),
  },
  voucher: {
    validate: requires('voucherCode', 'Falta el código del bono'),
    charge: (request) => ({
      accepted: true,
      amountCharged: 0,
      authorizationCode: `VOUCHER-${request.voucherCode}`,
      message: 'Pedido cubierto íntegramente con un bono',
    }),
  },
}
