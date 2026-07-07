export interface CreatePayOsPaymentLinkInput {
  orderCode: number
  amount: number
  description: string
  cancelUrl: string
  returnUrl: string
  expiredAt?: number
}

export interface PayOsPaymentLinkData {
  bin?: string
  accountNumber?: string
  accountName?: string
  amount: number
  description: string
  orderCode: number
  currency: string
  paymentLinkId: string
  status: string
  checkoutUrl: string
  qrCode: string
}

export interface PayOsApiResponse<T> {
  code: string
  desc: string
  data: T
  signature?: string
}