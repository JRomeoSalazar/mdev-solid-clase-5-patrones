import type { CheckoutRequest } from './types.ts'

type RequiredFields = 'orderId' | 'eventId' | 'customerEmail' | 'customerName' | 'ticketType' | 'quantity' | 'paymentMethod'

/** Named fields instead of 14 positional arguments; optional ones have safe defaults. */
export function buildCheckoutRequest(
  fields: Pick<CheckoutRequest, RequiredFields> & Partial<CheckoutRequest>,
): CheckoutRequest {
  return {
    cardToken: null,
    walletAccountId: null,
    voucherCode: null,
    discountPercentage: 0,
    isGift: false,
    giftMessage: null,
    marketingOptIn: false,
    ...fields,
  }
}
