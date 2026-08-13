import axios from 'axios'

import { providerError, ShippingAdapter, type ShippingIntegrationConfig, type ShippingTestResult } from './shipping-adapter'

export class AhamoveShippingAdapter extends ShippingAdapter {
  readonly provider = 'ahamove' as const
  readonly name = 'Ahamove'

  constructor(config: ShippingIntegrationConfig) { super(config) }

  async testConnection(): Promise<ShippingTestResult> {
    try {
      this.requireToken()
      await axios.get(`${this.baseUrl()}/services`, {
        params: { city_id: String(this.config.settings.cityId ?? 'SGN') },
        headers: this.headers(),
        timeout: 15_000,
      })
      return { success: true, message: 'Kết nối Ahamove thành công' }
    } catch (error) {
      return { success: false, message: `Lỗi kết nối Ahamove: ${providerError(error)}` }
    }
  }

  async execute(action: string, params: Record<string, unknown>) {
    if (action === 'calculateFee') {
      const data = await this.post('/orders/estimates', this.orderPayload(params, true))
      const first = Array.isArray(data) ? data[0] : data
      const value = this.object(first)
      return { fee: { ...value, total: Number(value.total_price ?? value.total_fee ?? value.total_pay ?? 0) } }
    }
    if (action === 'createOrder') {
      const data = this.object(await this.post('/orders', this.orderPayload(params, false)))
      return { order: { ...data, order_code: data.order_id, tracking_code: data.order_id } }
    }
    if (action === 'getTracking') {
      const response = await axios.get(`${this.baseUrl()}/orders/${encodeURIComponent(String(params.trackingCode))}`, { headers: this.headers(), timeout: 15_000 })
      return { tracking: response.data }
    }
    if (action === 'cancelOrder') {
      const code = encodeURIComponent(String(params.trackingCode))
      this.requireToken()
      const response = await axios.delete(`${this.baseUrl()}/orders/${code}`, {
        data: { comment: params.reason ?? 'Khách hàng yêu cầu huỷ' },
        headers: this.headers(),
        timeout: 15_000,
      })
      return { success: true, data: response.data }
    }
    throw new Error(`Ahamove không hỗ trợ action: ${action}`)
  }

  private orderPayload(params: Record<string, unknown>, estimate: boolean) {
    const pickup = this.object(params.pickup)
    const recipient = this.object(params.recipient)
    const parcel = this.object(params.parcel)
    this.requireStop(pickup, 'pickup')
    this.requireStop(recipient, 'recipient')
    const service = String(params.serviceCode ?? this.config.settings.serviceCode ?? 'BIKE')
    const products = Array.isArray(params.products) ? params.products as Record<string, unknown>[] : []
    const base = {
      order_time: 0,
      path: [this.stop(pickup), { ...this.stop(recipient), cod: Number(params.codAmount ?? 0), item_value: Number(params.insuranceValue ?? 0) }],
      payment_method: String(this.config.settings.paymentMethod ?? 'CASH'),
      remarks: String(params.note ?? ''),
      items: products.map(item => ({ _id: String(item.id ?? item.name), num: Number(item.quantity ?? 1), name: String(item.name), price: Number(item.price ?? 0) })),
      package_detail: [{
        weight: Math.max(Number(parcel.weight ?? 500) / 1000, 0.01),
        length: Number(parcel.length ?? 20),
        width: Number(parcel.width ?? 15),
        height: Number(parcel.height ?? 10),
        description: products.map(item => String(item.name)).join(', '),
      }],
    }
    return estimate
      ? { ...base, group_services: [{ _id: service }] }
      : { ...base, group_service_id: service }
  }

  private stop(value: Record<string, unknown>) {
    return {
      address: [value.address, value.ward, value.district, value.province].filter(Boolean).join(', '),
      name: String(value.name ?? ''),
      mobile: String(value.phone ?? value.mobile ?? ''),
      ...(value.latitude != null ? { lat: Number(value.latitude) } : {}),
      ...(value.longitude != null ? { lng: Number(value.longitude) } : {}),
    }
  }

  private async post(path: string, data: Record<string, unknown>) {
    this.requireToken()
    const response = await axios.post(`${this.baseUrl()}${path}`, data, { headers: this.headers(), timeout: 15_000 })
    return response.data as unknown
  }

  private headers() { return { Authorization: `Bearer ${this.config.credentials.token}`, 'Content-Type': 'application/json' } }
  private baseUrl() { return this.config.settings.environment === 'sandbox' ? 'https://partner-apistg.ahamove.com/v3' : 'https://partner-api.ahamove.com/v3' }
  private requireToken() { if (!this.config.credentials.token) throw new Error('Ahamove thiếu API token') }
  private requireStop(value: Record<string, unknown>, label: string) { if (!value.address || !value.province) throw new Error(`Ahamove thiếu địa chỉ ${label}`) }
  private object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
}
