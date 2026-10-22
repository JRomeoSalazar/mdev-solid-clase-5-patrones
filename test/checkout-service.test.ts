import { beforeEach, describe, expect, it } from 'vitest'
import { CheckoutService } from '../src/checkout-service.ts'
import { PaymentsGatewayV1 } from '../src/legacy/payments-gateway-v1.ts'
import {
  analyticsEvents,
  inventoryMovements,
  loyaltyPoints,
  mailbox,
  printQueue,
  resetSideEffects,
} from '../src/notifications/side-effects.ts'
import type { CheckoutRequest } from '../src/types.ts'

function request(overrides: Partial<CheckoutRequest> = {}): CheckoutRequest {
  return {
    orderId: 'ORD-1',
    eventId: 'EVT-9',
    customerEmail: 'ana@example.com',
    customerName: 'Ana García',
    ticketType: 'general',
    quantity: 2,
    paymentMethod: 'card',
    cardToken: 'TOK_OK',
    walletAccountId: null,
    voucherCode: null,
    discountPercentage: 0,
    isGift: false,
    giftMessage: null,
    marketingOptIn: false,
    ...overrides,
  }
}

describe('CheckoutService', () => {
  let gateway: PaymentsGatewayV1
  let service: CheckoutService

  beforeEach(() => {
    resetSideEffects()
    gateway = new PaymentsGatewayV1()
    service = new CheckoutService(gateway)
  })

  describe('pago con tarjeta', () => {
    it('cobra el importe con la comisión del 1,5% y emite las entradas', () => {
      const result = service.checkout(request())

      // 30 EUR x 2 entradas = 60 + 0,90 de comisión
      expect(result).toEqual({
        orderId: 'ORD-1',
        status: 'issued',
        amountCharged: 60.9,
        authorizationCode: 'AUTH-6090',
        message: 'Pago con tarjeta aceptado',
      })
    })

    it('aplica el descuento antes de calcular la comisión', () => {
      const result = service.checkout(request({ ticketType: 'vip', quantity: 2, discountPercentage: 10 }))

      // 90 x 2 = 180 -> -10% = 162 -> +1,5% = 164,43
      expect(result.amountCharged).toBe(164.43)
    })

    it('cancela el pedido cuando el banco rechaza la tarjeta', () => {
      const result = service.checkout(request({ cardToken: 'TOK_DECLINED' }))

      expect(result.status).toBe('cancelled')
      expect(result.amountCharged).toBe(0)
      expect(result.authorizationCode).toBeNull()
      expect(result.message).toBe('Tarjeta rechazada por el banco emisor')
    })

    it('cancela el pedido cuando no hay fondos suficientes', () => {
      const result = service.checkout(request({ quantity: 10 }))

      expect(result.status).toBe('cancelled')
      expect(result.message).toBe('Fondos insuficientes')
    })
  })

  describe('otros métodos de pago', () => {
    it('el monedero no cobra comisión', () => {
      const result = service.checkout(
        request({ paymentMethod: 'wallet', cardToken: null, walletAccountId: 'ACC-7' }),
      )

      expect(result.amountCharged).toBe(60)
      expect(result.authorizationCode).toBe('AUTH-6000')
      expect(result.message).toBe('Pago con monedero aceptado')
    })

    it('la transferencia no pasa por la pasarela y queda pendiente de confirmar', () => {
      const result = service.checkout(request({ paymentMethod: 'transfer', cardToken: null }))

      expect(result.amountCharged).toBe(60)
      expect(result.authorizationCode).toBeNull()
      expect(result.message).toBe('Transferencia pendiente de confirmación bancaria')
    })

    it('el bono cubre el importe completo', () => {
      const result = service.checkout(
        request({ paymentMethod: 'voucher', cardToken: null, voucherCode: 'REGALO24' }),
      )

      expect(result.amountCharged).toBe(0)
      expect(result.authorizationCode).toBe('VOUCHER-REGALO24')
      expect(result.message).toBe('Pedido cubierto íntegramente con un bono')
    })
  })

  describe('reintentos', () => {
    it('sin reintentos, un fallo temporal de la pasarela tumba la compra', () => {
      const result = service.checkout(request({ cardToken: 'TOK_FLAKY' }))

      expect(result.status).toBe('cancelled')
      expect(result.message).toBe('La pasarela de pago no responde')
    })

    it('con reintentos activados, la compra sale adelante', () => {
      const conReintentos = new CheckoutService(gateway, { withRetry: true, retryAttempts: 3 })

      const result = conReintentos.checkout(request({ cardToken: 'TOK_FLAKY' }))

      expect(result.status).toBe('issued')
      expect(result.amountCharged).toBe(60.9)
    })
  })

  describe('efectos de una compra', () => {
    it('avisa a los cinco sistemas que dependen de la venta', () => {
      service.checkout(request())

      expect(mailbox).toEqual([{ to: 'ana@example.com', subject: 'Tus entradas del pedido ORD-1' }])
      expect(analyticsEvents).toEqual([
        {
          name: 'ticket_purchased',
          payload: { orderId: 'ORD-1', eventId: 'EVT-9', amount: 60.9, method: 'card' },
        },
      ])
      expect(inventoryMovements).toEqual([{ eventId: 'EVT-9', delta: -2 }])
      expect(loyaltyPoints).toEqual([{ email: 'ana@example.com', points: 60 }])
      expect(printQueue).toEqual([{ orderId: 'ORD-1', quantity: 2 }])
    })

    it('no avisa a nadie cuando el pago se rechaza', () => {
      service.checkout(request({ cardToken: 'TOK_DECLINED' }))

      expect(mailbox).toEqual([])
      expect(analyticsEvents).toEqual([])
      expect(inventoryMovements).toEqual([])
      expect(printQueue).toEqual([])
    })
  })

  describe('validaciones', () => {
    it.each([
      [{ customerEmail: 'ana.example.com' }, 'Email inválido: ana.example.com'],
      [{ quantity: 0 }, 'Hay que comprar al menos una entrada'],
      [{ quantity: 11 }, 'No se pueden comprar más de 10 entradas en un mismo pedido'],
      [{ discountPercentage: 120 }, 'El descuento debe estar entre 0 y 100'],
      [{ ticketType: 'vip' as const, quantity: 5 }, 'Máximo 4 entradas VIP por pedido'],
      [{ isGift: true, quantity: 2 }, 'Los pedidos de regalo solo admiten una entrada'],
      [{ cardToken: null }, 'Falta el token de la tarjeta'],
      [
        { paymentMethod: 'wallet' as const, cardToken: null, walletAccountId: null },
        'Falta la cuenta del monedero',
      ],
      [
        { paymentMethod: 'voucher' as const, cardToken: null, voucherCode: null },
        'Falta el código del bono',
      ],
    ])('rechaza %o', (overrides, expectedMessage) => {
      expect(() => service.checkout(request(overrides))).toThrow(expectedMessage)
    })
  })
})
