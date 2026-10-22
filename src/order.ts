export type OrderStatus = 'created' | 'reserved' | 'paid' | 'issued' | 'cancelled' | 'refunded'

/**
 * Pedido de entradas. Lleva el estado y controla qué transiciones son legales.
 */
export class Order {
  private currentStatus: OrderStatus = 'created'
  private readonly transitions: OrderStatus[] = ['created']

  constructor(readonly id: string) {}

  get status(): OrderStatus {
    return this.currentStatus
  }

  history(): OrderStatus[] {
    return [...this.transitions]
  }

  reserve(): void {
    if (this.currentStatus !== 'created') {
      throw new Error(`No se puede reservar un pedido en estado "${this.currentStatus}"`)
    }
    this.moveTo('reserved')
  }

  markPaid(): void {
    if (this.currentStatus !== 'reserved') {
      throw new Error(`No se puede cobrar un pedido en estado "${this.currentStatus}"`)
    }
    this.moveTo('paid')
  }

  issueTickets(): void {
    if (this.currentStatus !== 'paid') {
      throw new Error(`No se pueden emitir entradas de un pedido en estado "${this.currentStatus}"`)
    }
    this.moveTo('issued')
  }

  cancel(): void {
    if (this.currentStatus === 'issued') {
      throw new Error('Un pedido con entradas emitidas ya no se puede cancelar, hay que reembolsarlo')
    }
    if (this.currentStatus === 'cancelled') {
      throw new Error('El pedido ya estaba cancelado')
    }
    if (this.currentStatus === 'refunded') {
      throw new Error('Un pedido reembolsado no se puede cancelar')
    }
    this.moveTo('cancelled')
  }

  refund(): void {
    if (this.currentStatus !== 'paid' && this.currentStatus !== 'issued') {
      throw new Error(`No se puede reembolsar un pedido en estado "${this.currentStatus}"`)
    }
    this.moveTo('refunded')
  }

  availableActions(): string[] {
    switch (this.currentStatus) {
      case 'created':
        return ['reserve', 'cancel']
      case 'reserved':
        return ['markPaid', 'cancel']
      case 'paid':
        return ['issueTickets', 'refund']
      case 'issued':
        return ['refund']
      case 'cancelled':
      case 'refunded':
        return []
    }
  }

  describe(): string {
    switch (this.currentStatus) {
      case 'created':
        return 'Pedido iniciado, sin entradas bloqueadas todavía'
      case 'reserved':
        return 'Entradas bloqueadas durante 15 minutos a la espera del pago'
      case 'paid':
        return 'Pago confirmado, pendiente de emitir las entradas'
      case 'issued':
        return 'Entradas emitidas y enviadas al cliente'
      case 'cancelled':
        return 'Pedido cancelado, las entradas han vuelto al aforo'
      case 'refunded':
        return 'Pedido reembolsado al cliente'
    }
  }

  isFinal(): boolean {
    switch (this.currentStatus) {
      case 'cancelled':
      case 'refunded':
        return true
      default:
        return false
    }
  }

  private moveTo(status: OrderStatus): void {
    this.currentStatus = status
    this.transitions.push(status)
  }
}
