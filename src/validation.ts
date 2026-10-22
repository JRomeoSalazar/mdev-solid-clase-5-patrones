import { paymentMethods } from './payment-methods.ts'
import type { CheckoutRequest } from './types.ts'

type Rule = (request: CheckoutRequest) => string | null

const MAX_TICKETS_PER_ORDER = 10
const MAX_VIP_TICKETS = 4
const MAX_DISCOUNT = 100

const commonRules: Rule[] = [
  (r) => (r.customerEmail.includes('@') ? null : `Email inválido: ${r.customerEmail}`),
  (r) => (r.quantity > 0 ? null : 'Hay que comprar al menos una entrada'),
  (r) =>
    r.quantity <= MAX_TICKETS_PER_ORDER
      ? null
      : `No se pueden comprar más de ${MAX_TICKETS_PER_ORDER} entradas en un mismo pedido`,
  (r) =>
    r.discountPercentage >= 0 && r.discountPercentage <= MAX_DISCOUNT
      ? null
      : `El descuento debe estar entre 0 y ${MAX_DISCOUNT}`,
  (r) =>
    r.ticketType === 'vip' && r.quantity > MAX_VIP_TICKETS
      ? `Máximo ${MAX_VIP_TICKETS} entradas VIP por pedido`
      : null,
  (r) => (r.isGift && r.quantity > 1 ? 'Los pedidos de regalo solo admiten una entrada' : null),
]

/** Throws on the first failing rule; the payment method's own rule runs last. */
export function validateRequest(request: CheckoutRequest): void {
  for (const rule of [...commonRules, paymentMethods[request.paymentMethod].validate]) {
    const error = rule(request)
    if (error) throw new Error(error)
  }
}
