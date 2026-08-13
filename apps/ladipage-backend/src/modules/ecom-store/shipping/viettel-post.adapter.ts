import axios from 'axios'

import { providerError, ShippingAdapter, type ShippingIntegrationConfig, type ShippingTestResult } from './shipping-adapter'

export class ViettelPostShippingAdapter extends ShippingAdapter {
  readonly provider = 'viettel_post' as const
  readonly name = 'Viettel Post'

  constructor(config: ShippingIntegrationConfig) { super(config) }

  async testConnection(): Promise<ShippingTestResult> {
    try {
      this.requireToken()
      const response = await this.post('/v2/user/listInventory', {})
      this.ensureSuccess(response)
      return { success: true, message: 'Kết nối Viettel Post thành công' }
    } catch (error) {
      return { success: false, message: `Lỗi kết nối Viettel Post: ${providerError(error)}` }
    }
  }

  async execute(action: string, params: Record<string, unknown>) {
    if (action === 'getProvinces') {
      const data = this.unwrap(await this.get('/v2/categories/listProvinceById', { provinceId: -1 }))
      const rows = Array.isArray(data) ? data : []
      return { provinces: rows.map(item => ({ ProvinceID: Number(this.object(item).PROVINCE_ID), ProvinceName: String(this.object(item).PROVINCE_NAME) })) }
    }
    if (action === 'getDistricts') {
      const data = this.unwrap(await this.get('/v2/categories/listDistrict', { provinceId: params.provinceId }))
      const rows = Array.isArray(data) ? data : []
      return { districts: rows.map(item => ({ DistrictID: Number(this.object(item).DISTRICT_ID), DistrictName: String(this.object(item).DISTRICT_NAME) })) }
    }
    if (action === 'getWards') {
      const data = this.unwrap(await this.get('/v2/categories/listWards', { districtId: params.districtId }))
      const rows = Array.isArray(data) ? data : []
      return { wards: rows.map(item => ({ WardCode: String(this.object(item).WARDS_ID), WardName: String(this.object(item).WARDS_NAME) })) }
    }
    if (action === 'calculateFee') {
      const data = this.ensureSuccess(await this.post('/v2/order/getPriceAllNlp', this.feePayload(params)))
      const value = this.object(this.unwrap(data))
      return { fee: { ...value, total: Number(value.MONEY_TOTAL ?? value.MONEY_TOTAL_FEE ?? value.total ?? 0) } }
    }
    if (action === 'createOrder') {
      const data = this.ensureSuccess(await this.post('/v2/order/createOrder', this.createPayload(params)))
      const value = this.object(this.unwrap(data))
      return { order: { ...value, order_code: value.ORDER_NUMBER ?? value.order_number, tracking_code: value.ORDER_NUMBER ?? value.order_number } }
    }
    if (action === 'getTracking') {
      return { tracking: this.ensureSuccess(await this.post('/v2/order/getOrderJourney', { ORDER_NUMBER: params.trackingCode })) }
    }
    if (action === 'cancelOrder') {
      return { success: true, data: this.ensureSuccess(await this.post('/v2/order/UpdateOrder', { TYPE: 4, ORDER_NUMBER: params.trackingCode, NOTE: params.reason ?? 'Khách hàng yêu cầu huỷ' })) }
    }
    throw new Error(`Viettel Post không hỗ trợ action: ${action}`)
  }

  private feePayload(params: Record<string, unknown>) {
    const pickup = this.object(params.pickup)
    const recipient = this.object(params.recipient)
    const parcel = this.object(params.parcel)
    this.requireAddress(pickup, 'pickup')
    this.requireAddress(recipient, 'recipient')
    return {
      PRODUCT_WEIGHT: Number(parcel.weight ?? 500),
      PRODUCT_PRICE: Number(params.insuranceValue ?? 0),
      MONEY_COLLECTION: Number(params.codAmount ?? 0),
      PRODUCT_LENGTH: Number(parcel.length ?? 20),
      PRODUCT_WIDTH: Number(parcel.width ?? 15),
      PRODUCT_HEIGHT: Number(parcel.height ?? 10),
      SENDER_ADDRESS: this.fullAddress(pickup),
      RECEIVER_ADDRESS: this.fullAddress(recipient),
      PRODUCT_TYPE: String(this.config.settings.productType ?? 'HH'),
      NATIONAL_TYPE: 1,
      ORDER_SERVICE: String(params.serviceCode ?? this.config.settings.serviceCode ?? ''),
    }
  }

  private createPayload(params: Record<string, unknown>) {
    const pickup = this.object(params.pickup)
    const recipient = this.object(params.recipient)
    const parcel = this.object(params.parcel)
    const products = Array.isArray(params.products) ? params.products as Record<string, unknown>[] : []
    this.requireAddress(pickup, 'pickup')
    this.requireAddress(recipient, 'recipient')
    const groupAddressId = Number(pickup.groupAddressId ?? this.config.settings.groupAddressId ?? 0)
    const cusId = Number(pickup.cusId ?? this.config.settings.cusId ?? 0)
    for (const [label, value] of [
      ['GROUPADDRESS_ID', groupAddressId],
      ['CUS_ID', cusId],
      ['pickup.provinceId', Number(pickup.provinceId ?? 0)],
      ['pickup.districtId', Number(pickup.districtId ?? 0)],
      ['pickup.wardId', Number(pickup.wardId ?? 0)],
      ['recipient.provinceId', Number(recipient.provinceId ?? 0)],
      ['recipient.districtId', Number(recipient.districtId ?? 0)],
      ['recipient.wardId', Number(recipient.wardId ?? 0)],
    ] as const) {
      if (!value) throw new Error(`Viettel Post thiếu ${label}`)
    }
    return {
      ORDER_NUMBER: String(params.referenceCode),
      GROUPADDRESS_ID: groupAddressId,
      CUS_ID: cusId,
      SENDER_FULLNAME: String(pickup.name ?? 'LadiPage Shop'),
      SENDER_ADDRESS: String(pickup.address),
      SENDER_PHONE: String(pickup.phone ?? ''),
      SENDER_PROVINCE: Number(pickup.provinceId ?? 0),
      SENDER_DISTRICT: Number(pickup.districtId ?? 0),
      SENDER_WARD: Number(pickup.wardId ?? 0),
      RECEIVER_FULLNAME: String(recipient.name ?? ''),
      RECEIVER_ADDRESS: String(recipient.address),
      RECEIVER_PHONE: String(recipient.phone ?? ''),
      RECEIVER_PROVINCE: Number(recipient.provinceId ?? 0),
      RECEIVER_DISTRICT: Number(recipient.districtId ?? 0),
      RECEIVER_WARD: Number(recipient.wardId ?? 0),
      PRODUCT_NAME: products.map(item => String(item.name)).join(', ') || 'Hàng hóa',
      PRODUCT_DESCRIPTION: String(params.note ?? ''),
      PRODUCT_QUANTITY: products.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0) || 1,
      PRODUCT_PRICE: Number(params.insuranceValue ?? 0),
      PRODUCT_WEIGHT: Number(parcel.weight ?? 500),
      PRODUCT_LENGTH: Number(parcel.length ?? 20),
      PRODUCT_WIDTH: Number(parcel.width ?? 15),
      PRODUCT_HEIGHT: Number(parcel.height ?? 10),
      PRODUCT_TYPE: String(this.config.settings.productType ?? 'HH'),
      ORDER_PAYMENT: Number(this.config.settings.orderPayment ?? 3),
      ORDER_SERVICE: String(params.serviceCode ?? this.config.settings.serviceCode ?? ''),
      ORDER_SERVICE_ADD: String(this.config.settings.serviceAddon ?? ''),
      MONEY_COLLECTION: Number(params.codAmount ?? 0),
      CHECK_UNIQUE: true,
    }
  }

  private async post(path: string, data: Record<string, unknown>) {
    this.requireToken()
    const response = await axios.post(`${this.baseUrl()}${path}`, data, {
      timeout: 15_000,
      headers: { Token: this.config.credentials.token, 'Content-Type': 'application/json' },
    })
    return response.data as Record<string, unknown>
  }

  private async get(path: string, params: Record<string, unknown>) {
    this.requireToken()
    const response = await axios.get(`${this.baseUrl()}${path}`, {
      params,
      timeout: 15_000,
      headers: { Token: this.config.credentials.token },
    })
    return response.data as Record<string, unknown>
  }

  private ensureSuccess(data: Record<string, unknown>) {
    if (data.status === false || (data.status != null && Number(data.status) !== 200 && Number(data.status) !== 1)) {
      throw new Error(String(data.message ?? data.error ?? 'Viettel Post request failed'))
    }
    return data
  }

  private unwrap(data: Record<string, unknown>): unknown { return data.data ?? data.result ?? data }
  private fullAddress(value: Record<string, unknown>) { return [value.address, value.ward, value.district, value.province].filter(Boolean).join(', ') }
  private requireToken() { if (!this.config.credentials.token) throw new Error('Viettel Post thiếu token') }
  private requireAddress(value: Record<string, unknown>, label: string) { if (!value.address || !value.province || !value.district) throw new Error(`Viettel Post thiếu địa chỉ ${label}`) }
  private object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
  private baseUrl() { return this.config.settings.environment === 'sandbox' ? 'https://partnerdev.viettelpost.vn' : 'https://partner.viettelpost.vn' }
}
