/**
 * Los cinco sistemas a los que hay que avisar cuando se vende una entrada.
 * Todos son fachadas en memoria para que el ejemplo se pueda ejecutar.
 */

export const mailbox: { to: string; subject: string }[] = []
export const analyticsEvents: { name: string; payload: Record<string, unknown> }[] = []
export const inventoryMovements: { eventId: string; delta: number }[] = []
export const loyaltyPoints: { email: string; points: number }[] = []
export const printQueue: { orderId: string; quantity: number }[] = []

export const emailService = {
  sendPurchaseConfirmation(to: string, orderId: string): void {
    mailbox.push({ to, subject: `Tus entradas del pedido ${orderId}` })
  },
}

export const analyticsService = {
  track(name: string, payload: Record<string, unknown>): void {
    analyticsEvents.push({ name, payload })
  },
}

export const inventoryService = {
  release(eventId: string, quantity: number): void {
    inventoryMovements.push({ eventId, delta: -quantity })
  },
}

export const loyaltyService = {
  award(email: string, points: number): void {
    loyaltyPoints.push({ email, points })
  },
}

export const warehouseService = {
  schedulePrinting(orderId: string, quantity: number): void {
    printQueue.push({ orderId, quantity })
  },
}

export function resetSideEffects(): void {
  mailbox.length = 0
  analyticsEvents.length = 0
  inventoryMovements.length = 0
  loyaltyPoints.length = 0
  printQueue.length = 0
}
