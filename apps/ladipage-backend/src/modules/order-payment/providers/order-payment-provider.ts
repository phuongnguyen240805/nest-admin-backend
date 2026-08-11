export interface OrderPaymentProviderCreateInput {
  referenceCode: string
  amount: number
}

export interface OrderPaymentProviderCreateResult {
  qrUrl?: string
  metadata?: Record<string, unknown>
}

export interface OrderPaymentProvider {
  createPayment(input: OrderPaymentProviderCreateInput): OrderPaymentProviderCreateResult
}
