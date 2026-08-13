import { createHash } from 'node:crypto'
import axios from 'axios'

import {
  providerError,
  ShippingAdapter,
  type ShippingIntegrationConfig,
  type ShippingTestResult,
} from './shipping-adapter'

type JtAction = 'calculateFee' | 'createOrder' | 'getTracking' | 'cancelOrder'

const PATHS: Record<JtAction, string> = {
  calculateFee: '/webopenplatformapi/api/spmComCost/getComCost',
  createOrder: '/webopenplatformapi/api/order/addOrder',
  getTracking: '/webopenplatformapi/api/logistics/trace',
  cancelOrder: '/webopenplatformapi/api/order/cancelOrder',
}

export class JtExpressShippingAdapter extends ShippingAdapter {
  readonly provider = 'jt_express' as const
  readonly name = 'J&T Express'

  constructor(config: ShippingIntegrationConfig) {
    super(config)
  }

  async testConnection(): Promise<ShippingTestResult> {
    try {
      this.requireCredentials()
      const pickup = this.object(this.config.settings.pickup)
      this.requireAddress(pickup, 'pickup')
      await this.request('calculateFee', this.feePayload({
        pickup,
        recipient: pickup,
        parcel: { weight: 1000, length: 10, width: 10, height: 10 },
        insuranceValue: 0,
        codAmount: 0,
      }))
      return { success: true, message: 'Kết nối J&T Express thành công' }
    } catch (error) {
      return { success: false, message: `Lỗi kết nối J&T Express: ${providerError(error)}` }
    }
  }

  async execute(action: string, params: Record<string, unknown>) {
    if (!(action in PATHS)) throw new Error(`J&T Express không hỗ trợ action: ${action}`)
    const jtAction = action as JtAction
    const payload = jtAction === 'calculateFee'
      ? this.feePayload(params)
      : jtAction === 'createOrder'
        ? this.createPayload(params)
        : jtAction === 'getTracking'
          ? this.trackingPayload(params)
          : this.cancelPayload(params)
    const data = await this.request(jtAction, payload)
    if (jtAction === 'calculateFee') return { fee: this.normalizeFee(data) }
    if (jtAction === 'createOrder') return { order: this.normalizeOrder(data) }
    if (jtAction === 'getTracking') return { tracking: data.data ?? data }
    return { success: true, data }
  }

  private async request(action: JtAction, bizContent: Record<string, unknown>) {
    this.requireCredentials()
    const raw = JSON.stringify(bizContent)
    const digest = createHash('md5')
      .update(raw + this.config.credentials.privateKey)
      .digest('base64')
    const form = new URLSearchParams({ bizContent: raw })
    const response = await axios.post(`${this.baseUrl()}${PATHS[action]}`, form.toString(), {
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apiAccount: this.config.credentials.apiAccount,
        digest,
        timestamp: String(Date.now()),
      },
    })
    const data = response.data as Record<string, unknown>
    if (String(data.code) !== '1') throw new Error(String(data.msg ?? 'J&T request failed'))
    return data
  }

  private feePayload(params: Record<string, unknown>) {
    const pickup = this.object(params.pickup)
    const recipient = this.object(params.recipient)
    const parcel = this.object(params.parcel)
    this.requireAddress(pickup, 'pickup')
    this.requireAddress(recipient, 'recipient')
    return {
      ...this.identity(),
      weight: Math.max(Number(parcel.weight ?? 500) / 1000, 0.01),
      isInsured: Number(params.insuranceValue ?? 0) > 0 ? 1 : 0,
      goodsValue: Number(params.insuranceValue ?? 0),
      codMoney: String(params.codAmount ?? 0),
      length: Number(parcel.length ?? 20),
      width: Number(parcel.width ?? 15),
      height: Number(parcel.height ?? 10),
      goodsType: String(this.config.settings.goodsType ?? 'bm000010'),
      productType: String(params.serviceCode ?? this.config.settings.serviceCode ?? 'EXPRESS'),
      sender: this.address(pickup),
      receiver: this.address(recipient),
    }
  }

  private createPayload(params: Record<string, unknown>) {
    const pickup = this.object(params.pickup)
    const recipient = this.object(params.recipient)
    const parcel = this.object(params.parcel)
    const products = Array.isArray(params.products) ? params.products as Record<string, unknown>[] : []
    this.requireAddress(pickup, 'pickup')
    this.requireAddress(recipient, 'recipient')
    return {
      ...this.identity(),
      txlogisticId: String(params.referenceCode),
      orderType: 1,
      serviceType: Number(this.config.settings.serviceType ?? 1),
      payType: String(this.config.settings.payType ?? 'PP_PM'),
      productType: String(params.serviceCode ?? this.config.settings.serviceCode ?? 'EXPRESS'),
      goodsType: String(this.config.settings.goodsType ?? 'bm000010'),
      deliveryType: Number(this.config.settings.deliveryType ?? 1),
      sender: this.address(pickup, true),
      receiver: this.address(recipient, true),
      packageInfo: {
        weight: Math.max(Number(parcel.weight ?? 500) / 1000, 0.01),
        length: Number(parcel.length ?? 20),
        width: Number(parcel.width ?? 15),
        height: Number(parcel.height ?? 10),
      },
      isInsured: Number(params.insuranceValue ?? 0) > 0 ? 1 : 0,
      goodsValue: Number(params.insuranceValue ?? 0),
      codMoney: String(params.codAmount ?? 0),
      remark: String(params.note ?? ''),
      items: products.map((item) => ({
        itemName: String(item.name ?? 'Hàng hóa'),
        englishName: String(item.englishName ?? 'Goods'),
        number: String(item.quantity ?? 1),
        itemValue: String(item.price ?? 0),
      })),
    }
  }

  private trackingPayload(params: Record<string, unknown>) {
    return { ...this.identity(), txlogisticId: String(params.orderCode ?? ''), billcodes: String(params.trackingCode ?? '') }
  }

  private cancelPayload(params: Record<string, unknown>) {
    return {
      ...this.identity(),
      txlogisticId: String(params.orderCode ?? params.trackingCode ?? ''),
      billCode: String(params.trackingCode ?? ''),
      reason: String(params.reason ?? 'Khách hàng yêu cầu huỷ'),
    }
  }

  private identity() {
    const password = this.config.credentials.password
    return {
      customerCode: this.config.credentials.customerCode,
      password: /^[A-F0-9]{32}$/.test(password)
        ? password
        : createHash('md5').update(`${password}jadada369t3`).digest('hex').toUpperCase(),
    }
  }

  private address(value: Record<string, unknown>, includeContact = false) {
    return {
      ...(includeContact ? { name: String(value.name), mobile: String(value.phone ?? value.mobile) } : {}),
      prov: String(value.province),
      city: String(value.city ?? ''),
      area: String(value.district ?? value.area),
      address: String(value.address),
    }
  }

  private normalizeFee(data: Record<string, unknown>) {
    const value = this.object(data.data)
    return { ...value, total: Number(value.totalFee ?? value.total_fee ?? value.freight ?? value.price ?? 0) }
  }

  private normalizeOrder(data: Record<string, unknown>) {
    const value = this.object(data.data)
    return { ...value, order_code: value.billCode ?? value.txlogisticId, tracking_code: value.billCode }
  }

  private requireCredentials() {
    for (const key of ['apiAccount', 'privateKey', 'customerCode', 'password']) {
      if (!this.config.credentials[key]) throw new Error(`J&T Express thiếu ${key}`)
    }
  }

  private requireAddress(value: Record<string, unknown>, label: string) {
    for (const key of ['province', 'district', 'address']) {
      if (!value[key]) throw new Error(`J&T Express thiếu ${label}.${key}`)
    }
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
  }

  private baseUrl() {
    const sandbox = this.config.settings.environment === 'sandbox'
    return sandbox ? 'https://demoopenapi.jtexpress.vn' : 'https://ylopenapi.jtexpress.vn'
  }
}
