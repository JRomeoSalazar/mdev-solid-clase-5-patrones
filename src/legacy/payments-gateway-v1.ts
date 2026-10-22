/**
 * Pasarela de pagos del proveedor. Es una integración de 2011 y su API sigue
 * siendo la de entonces: campos en mayúsculas, importes en céntimos, metadatos
 * en una cadena "clave=valor;clave=valor" y códigos numéricos de resultado.
 *
 * No podemos cambiarla: es código de terceros.
 */
export interface LegacyPaymentRequest {
  AMOUNT_IN_CENTS: number
  CURRENCY_CODE: string
  OPERATION: 'SALE' | 'REFUND'
  CARD_TOKEN?: string
  ACCOUNT_ID?: string
  META: string
}

export interface LegacyPaymentResponse {
  RESULT_CODE: '00' | '05' | '51' | '99'
  AUTH_CODE?: string
  MESSAGE: string
}

export class PaymentsGatewayV1 {
  private readonly attemptsByToken = new Map<string, number>()

  execute(request: LegacyPaymentRequest): LegacyPaymentResponse {
    const token = request.CARD_TOKEN ?? request.ACCOUNT_ID ?? 'UNKNOWN'

    if (token === 'TOK_DECLINED') {
      return { RESULT_CODE: '05', MESSAGE: 'DECLINED BY ISSUER' }
    }

    if (token === 'TOK_FLAKY') {
      const attempts = (this.attemptsByToken.get(token) ?? 0) + 1
      this.attemptsByToken.set(token, attempts)
      if (attempts < 3) {
        return { RESULT_CODE: '99', MESSAGE: 'TEMPORARY GATEWAY ERROR' }
      }
    }

    if (request.AMOUNT_IN_CENTS > 30000) {
      return { RESULT_CODE: '51', MESSAGE: 'INSUFFICIENT FUNDS' }
    }

    return {
      RESULT_CODE: '00',
      AUTH_CODE: `AUTH-${request.AMOUNT_IN_CENTS}`,
      MESSAGE: 'APPROVED',
    }
  }

  reset(): void {
    this.attemptsByToken.clear()
  }
}
