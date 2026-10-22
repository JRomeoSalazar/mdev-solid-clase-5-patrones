import { describe, expect, it } from 'vitest'
import { Order } from '../src/order.ts'

describe('Order', () => {
  it('empieza en estado "created"', () => {
    const order = new Order('ORD-1')

    expect(order.status).toBe('created')
    expect(order.history()).toEqual(['created'])
    expect(order.isFinal()).toBe(false)
  })

  it('recorre el camino feliz: reservar, cobrar y emitir', () => {
    const order = new Order('ORD-1')

    order.reserve()
    order.markPaid()
    order.issueTickets()

    expect(order.status).toBe('issued')
    expect(order.history()).toEqual(['created', 'reserved', 'paid', 'issued'])
  })

  it('describe en qué punto está el pedido', () => {
    const order = new Order('ORD-1')
    expect(order.describe()).toBe('Pedido iniciado, sin entradas bloqueadas todavía')

    order.reserve()
    expect(order.describe()).toBe('Entradas bloqueadas durante 15 minutos a la espera del pago')

    order.markPaid()
    expect(order.describe()).toBe('Pago confirmado, pendiente de emitir las entradas')

    order.issueTickets()
    expect(order.describe()).toBe('Entradas emitidas y enviadas al cliente')
  })

  it('dice qué se puede hacer en cada momento', () => {
    const order = new Order('ORD-1')
    expect(order.availableActions()).toEqual(['reserve', 'cancel'])

    order.reserve()
    expect(order.availableActions()).toEqual(['markPaid', 'cancel'])

    order.markPaid()
    expect(order.availableActions()).toEqual(['issueTickets', 'refund'])

    order.issueTickets()
    expect(order.availableActions()).toEqual(['refund'])

    order.refund()
    expect(order.availableActions()).toEqual([])
    expect(order.isFinal()).toBe(true)
  })

  describe('transiciones ilegales', () => {
    it('no se puede cobrar un pedido que no está reservado', () => {
      expect(() => new Order('ORD-1').markPaid()).toThrow('No se puede cobrar un pedido en estado "created"')
    })

    it('no se pueden emitir entradas sin haber cobrado', () => {
      const order = new Order('ORD-1')
      order.reserve()

      expect(() => order.issueTickets()).toThrow(
        'No se pueden emitir entradas de un pedido en estado "reserved"',
      )
    })

    it('no se puede reservar dos veces', () => {
      const order = new Order('ORD-1')
      order.reserve()

      expect(() => order.reserve()).toThrow('No se puede reservar un pedido en estado "reserved"')
    })

    it('un pedido con entradas emitidas se reembolsa, no se cancela', () => {
      const order = new Order('ORD-1')
      order.reserve()
      order.markPaid()
      order.issueTickets()

      expect(() => order.cancel()).toThrow(
        'Un pedido con entradas emitidas ya no se puede cancelar, hay que reembolsarlo',
      )
      order.refund()
      expect(order.status).toBe('refunded')
    })

    it('no se puede cancelar dos veces', () => {
      const order = new Order('ORD-1')
      order.cancel()

      expect(() => order.cancel()).toThrow('El pedido ya estaba cancelado')
    })

    it('no se puede reembolsar un pedido que nunca se pagó', () => {
      const order = new Order('ORD-1')
      order.reserve()

      expect(() => order.refund()).toThrow('No se puede reembolsar un pedido en estado "reserved"')
    })
  })
})
