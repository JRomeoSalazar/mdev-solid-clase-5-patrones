export type TicketType = 'general' | 'vip' | 'early-bird'
export type PaymentMethod = 'card' | 'wallet' | 'transfer' | 'voucher'

export interface CheckoutRequest {
  orderId: string
  eventId: string
  customerEmail: string
  customerName: string
  ticketType: TicketType
  quantity: number
  paymentMethod: PaymentMethod
  cardToken: string | null
  walletAccountId: string | null
  voucherCode: string | null
  discountPercentage: number
  isGift: boolean
  giftMessage: string | null
  marketingOptIn: boolean
}

export interface CheckoutResult {
  orderId: string
  status: string
  amountCharged: number
  authorizationCode: string | null
  message: string
}
