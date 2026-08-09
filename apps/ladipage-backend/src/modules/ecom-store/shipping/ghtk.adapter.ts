import axios from 'axios'

import {
  providerError,
  ShippingAdapter,
  ShippingTestResult,
} from './shipping-adapter'

export class GhtkShippingAdapter extends ShippingAdapter {
  readonly provider = 'ghtk' as const
  readonly name = 'Giao Hàng Tiết Kiệm'
  private readonly baseUrl = 'https://services.giaohangtietkiem.vn'

  private get headers() {
    return {
      Token: this.config.credentials.token,
      'Content-Type': 'application/json',
    }
  }

  async testConnection(): Promise<ShippingTestResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/services/balance`, {
        headers: this.headers,
        timeout: 10_000,
      })
      if (!response.data?.success) {
        return {
          success: false,
          message: response.data?.message || 'Không thể kết nối GHTK',
        }
      }
      const balance = Number(response.data?.data?.balance ?? 0)
      return {
        success: true,
        message: `Kết nối GHTK thành công - Số dư: ${balance.toLocaleString('vi-VN')}đ`,
      }
    } catch (error) {
      return { success: false, message: `Lỗi kết nối GHTK: ${providerError(error)}` }
    }
  }

  async execute(action: string, params: Record<string, unknown>) {
    switch (action) {
      case 'createOrder': {
        const response = await axios.post(
          `${this.baseUrl}/services/shipment/order`,
          params,
          { headers: this.headers, timeout: 15_000 },
        )
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Tạo đơn GHTK thất bại')
        }
        return { order: response.data?.order ?? {} }
      }
      case 'getTracking': {
        const code = encodeURIComponent(String(params.trackingCode ?? ''))
        const response = await axios.get(
          `${this.baseUrl}/services/shipment/v2/${code}`,
          { headers: this.headers, timeout: 10_000 },
        )
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Không tìm thấy vận đơn')
        }
        return { tracking: response.data?.order ?? {} }
      }
      case 'cancelOrder': {
        const code = encodeURIComponent(String(params.trackingCode ?? ''))
        const response = await axios.post(
          `${this.baseUrl}/services/shipment/cancel/${code}`,
          {},
          { headers: this.headers, timeout: 10_000 },
        )
        return {
          success: Boolean(response.data?.success),
          message: response.data?.message,
        }
      }
      case 'calculateFee': {
        const response = await axios.post(
          `${this.baseUrl}/services/shipment/fee`,
          params,
          { headers: this.headers, timeout: 10_000 },
        )
        return { fee: response.data?.fee ?? response.data ?? {} }
      }
      default:
        throw new Error(`GHTK không hỗ trợ action: ${action}`)
    }
  }
}
