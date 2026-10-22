import { CheckoutService, createCheckoutRequest } from './checkout-service.ts'
import { PaymentsGatewayV1 } from './legacy/payments-gateway-v1.ts'
import { Order } from './order.ts'
import { analyticsEvents, mailbox, printQueue } from './notifications/side-effects.ts'

const gateway = new PaymentsGatewayV1()
const service = new CheckoutService(gateway, { withLogging: true, withRetry: true, retryAttempts: 3 })

// Catorce parámetros posicionales. Suerte adivinando cuál es cuál.
const peticion = createCheckoutRequest(
  'ORD-2045',
  'EVT-9',
  'ana@example.com',
  'Ana García',
  'vip',
  2,
  'card',
  'TOK_FLAKY',
  null,
  null,
  10,
  false,
  null,
  true,
)

console.log('--- Compra ---')
console.log(service.checkout(peticion))

console.log('\n--- Log interno ---')
for (const linea of service.logLines) console.log(linea)

console.log('\n--- Sistemas avisados ---')
console.log('Buzón:', mailbox)
console.log('Analítica:', analyticsEvents)
console.log('Cola de impresión:', printQueue)

console.log('\n--- Ciclo de vida del pedido ---')
const order = new Order('ORD-2046')
for (const paso of ['reserve', 'markPaid', 'issueTickets'] as const) {
  order[paso]()
  console.log(`${order.status.padEnd(10)} | ${order.describe()}`)
  console.log(`${' '.repeat(10)} | acciones: ${order.availableActions().join(', ') || '—'}`)
}
