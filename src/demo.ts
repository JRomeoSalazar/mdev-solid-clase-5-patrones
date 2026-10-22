import { buildCheckoutRequest } from './checkout-request.ts'
import { CheckoutService } from './checkout-service.ts'
import { PaymentsGatewayV1 } from './legacy/payments-gateway-v1.ts'
import { Order, type OrderAction } from './order.ts'
import { analyticsEvents, mailbox, printQueue } from './notifications/side-effects.ts'

const STATUS_COLUMN_WIDTH = 10
const LIFECYCLE: OrderAction[] = ['reserve', 'markPaid', 'issueTickets']

const service = new CheckoutService(new PaymentsGatewayV1(), {
  withLogging: true,
  withRetry: true,
  retryAttempts: 3,
})

const request = buildCheckoutRequest({
  orderId: 'ORD-2045',
  eventId: 'EVT-9',
  customerEmail: 'ana@example.com',
  customerName: 'Ana García',
  ticketType: 'vip',
  quantity: 2,
  paymentMethod: 'card',
  cardToken: 'TOK_FLAKY',
  discountPercentage: 10,
  marketingOptIn: true,
})

console.log('--- Compra ---')
console.log(service.checkout(request))

console.log('\n--- Log interno ---')
service.logLines.forEach((line) => console.log(line))

console.log('\n--- Sistemas avisados ---')
console.log('Buzón:', mailbox)
console.log('Analítica:', analyticsEvents)
console.log('Cola de impresión:', printQueue)

console.log('\n--- Ciclo de vida del pedido ---')
const order = new Order('ORD-2046')
LIFECYCLE.forEach((action) => {
  order[action]()
  console.log(`${order.status.padEnd(STATUS_COLUMN_WIDTH)} | ${order.describe()}`)
  console.log(`${' '.repeat(STATUS_COLUMN_WIDTH)} | acciones: ${order.availableActions().join(', ') || '—'}`)
})
