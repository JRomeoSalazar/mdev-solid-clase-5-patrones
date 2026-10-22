export type OrderStatus = 'created' | 'reserved' | 'paid' | 'issued' | 'cancelled' | 'refunded'
export type OrderAction = 'reserve' | 'markPaid' | 'issueTickets' | 'cancel' | 'refund'

interface Transition {
  to: OrderStatus
  from: OrderStatus[]
  error: (status: OrderStatus) => string
}

interface StateInfo {
  description: string
  actions: OrderAction[]
}

const CANCEL_ERRORS: Record<string, string> = {
  issued: 'Un pedido con entradas emitidas ya no se puede cancelar, hay que reembolsarlo',
  cancelled: 'El pedido ya estaba cancelado',
  refunded: 'Un pedido reembolsado no se puede cancelar',
}

const TRANSITIONS: Record<OrderAction, Transition> = {
  reserve: {
    to: 'reserved',
    from: ['created'],
    error: (status) => `No se puede reservar un pedido en estado "${status}"`,
  },
  markPaid: {
    to: 'paid',
    from: ['reserved'],
    error: (status) => `No se puede cobrar un pedido en estado "${status}"`,
  },
  issueTickets: {
    to: 'issued',
    from: ['paid'],
    error: (status) => `No se pueden emitir entradas de un pedido en estado "${status}"`,
  },
  cancel: {
    to: 'cancelled',
    from: ['created', 'reserved', 'paid'],
    error: (status) => CANCEL_ERRORS[status] ?? `No se puede cancelar un pedido en estado "${status}"`,
  },
  refund: {
    to: 'refunded',
    from: ['paid', 'issued'],
    error: (status) => `No se puede reembolsar un pedido en estado "${status}"`,
  },
}

// "actions" is what we advertise to the user, not every transition `TRANSITIONS`
// allows: a paid order can still be cancelled, but only issuing or refunding is offered.
const STATES: Record<OrderStatus, StateInfo> = {
  created: {
    description: 'Pedido iniciado, sin entradas bloqueadas todavía',
    actions: ['reserve', 'cancel'],
  },
  reserved: {
    description: 'Entradas bloqueadas durante 15 minutos a la espera del pago',
    actions: ['markPaid', 'cancel'],
  },
  paid: {
    description: 'Pago confirmado, pendiente de emitir las entradas',
    actions: ['issueTickets', 'refund'],
  },
  issued: {
    description: 'Entradas emitidas y enviadas al cliente',
    actions: ['refund'],
  },
  cancelled: {
    description: 'Pedido cancelado, las entradas han vuelto al aforo',
    actions: [],
  },
  refunded: {
    description: 'Pedido reembolsado al cliente',
    actions: [],
  },
}

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
    this.apply('reserve')
  }

  markPaid(): void {
    this.apply('markPaid')
  }

  issueTickets(): void {
    this.apply('issueTickets')
  }

  cancel(): void {
    this.apply('cancel')
  }

  refund(): void {
    this.apply('refund')
  }

  availableActions(): OrderAction[] {
    return [...STATES[this.currentStatus].actions]
  }

  describe(): string {
    return STATES[this.currentStatus].description
  }

  isFinal(): boolean {
    return STATES[this.currentStatus].actions.length === 0
  }

  private apply(action: OrderAction): void {
    const { to, from, error } = TRANSITIONS[action]
    if (!from.includes(this.currentStatus)) {
      throw new Error(error(this.currentStatus))
    }
    this.currentStatus = to
    this.transitions.push(to)
  }
}
