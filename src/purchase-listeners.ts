import {
  analyticsService,
  emailService,
  inventoryService,
  loyaltyService,
  warehouseService,
} from './notifications/side-effects.ts'
import type { CheckoutRequest } from './types.ts'

export interface PurchaseCompleted {
  request: CheckoutRequest
  amountCharged: number
}

export type PurchaseListener = (event: PurchaseCompleted) => void

/** Everything that must react to a completed purchase, in call order. */
export const purchaseListeners: PurchaseListener[] = [
  ({ request }) => emailService.sendPurchaseConfirmation(request.customerEmail, request.orderId),
  ({ request, amountCharged }) =>
    analyticsService.track('ticket_purchased', {
      orderId: request.orderId,
      eventId: request.eventId,
      amount: amountCharged,
      method: request.paymentMethod,
    }),
  ({ request }) => inventoryService.release(request.eventId, request.quantity),
  ({ request, amountCharged }) => loyaltyService.award(request.customerEmail, Math.floor(amountCharged)),
  ({ request }) => warehouseService.schedulePrinting(request.orderId, request.quantity),
]
