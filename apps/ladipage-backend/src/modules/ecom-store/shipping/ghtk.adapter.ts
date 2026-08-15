import axios from 'axios'

import {
  providerError,
  ShippingAdapter,
  ShippingTestResult,
} from './shipping-adapter'

export class GhtkShippingAdapter extends ShippingAdapter {
  readonly provider = 'ghtk' as const
  readonly name = 'Giao Hàng Tiết Kiệm'

  private get baseUrl() {
    return this.config.settings.environment === 'sandbox'
      ? 'https://services-staging.ghtklab.com'
      : 'https://services.giaohangtietkiem.vn'
  }

  private get headers() {
    const partnerCode = String(this.config.credentials.customerCode ?? '').trim()
    return {
      Token: this.config.credentials.token,
      ...(partnerCode ? { 'X-Client-Source': partnerCode } : {}),
      'Content-Type': 'application/json',
    }
  }

  async testConnection(): Promise<ShippingTestResult> {
    try {
      const partnerCode = String(this.config.credentials.customerCode ?? '').trim()
      if (!partnerCode) {
        return {
          success: false,
          message: 'GHTK thiếu Partner Code / Shop Code (X-Client-Source)',
        }
      }

      const response = await axios.get(`${this.baseUrl}/services/authenticated`, {
        headers: this.headers,
        timeout: 10_000,
      })
      if (!response.data?.success) {
        return {
          success: false,
          message: response.data?.message || 'Không thể xác thực GHTK',
        }
      }
      return {
        success: true,
        message: `Kết nối GHTK thành công (${this.config.settings.environment === 'sandbox' ? 'Staging' : 'Production'})`,
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
        const response = await axios.get(
          `${this.baseUrl}/services/shipment/fee`,
          {
            headers: this.headers,
            params,
            timeout: 10_000,
          },
        )
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Tính phí GHTK thất bại')
        }

        const providerFee = response.data?.fee ?? {}
        if (providerFee.delivery === false) {
          throw new Error('GHTK chưa hỗ trợ giao tới địa chỉ này')
        }
        const serviceFee = Number(providerFee.fee ?? 0)
        const insuranceFee = Number(providerFee.insurance_fee ?? 0)
        return {
          fee: {
            ...providerFee,
            total: serviceFee + insuranceFee,
            service_fee: serviceFee,
            insurance_fee: insuranceFee,
          },
        }
      }
      default:
        throw new Error(`GHTK không hỗ trợ action: ${action}`)
    }
  }
}
