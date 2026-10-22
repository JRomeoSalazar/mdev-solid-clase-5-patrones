import type { CheckoutRequest, TicketType } from './types.ts'

const BASE_PRICES: Record<TicketType, number> = {
  general: 30,
  vip: 90,
  'early-bird': 20,
}

/** Order total after the discount, before any payment-method fee. */
export function discountedTotal(request: CheckoutRequest): number {
  const gross = BASE_PRICES[request.ticketType] * request.quantity
  return gross - (gross * request.discountPercentage) / 100
}
