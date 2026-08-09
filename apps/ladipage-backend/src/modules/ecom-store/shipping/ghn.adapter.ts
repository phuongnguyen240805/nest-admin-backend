import axios from 'axios'

import {
  providerError,
  ShippingAdapter,
  ShippingTestResult,
} from './shipping-adapter'

export class GhnShippingAdapter extends ShippingAdapter {
  readonly provider = 'ghn' as const
  readonly name = 'Giao Hàng Nhanh'

  private get baseUrl() {
    return this.config.settings.environment === 'sandbox'
      ? 'https://dev-online-gateway.ghn.vn/shiip/public-api'
      : 'https://online-gateway.ghn.vn/shiip/public-api'
  }

  private get tokenHeaders() {
    return {
      Token: this.config.credentials.token,
      'Content-Type': 'application/json',
    }
  }

  private get headers() {
    return {
      ...this.tokenHeaders,
      ShopId: this.config.credentials.shopId,
    }
  }

  async testConnection(): Promise<ShippingTestResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/v2/shop/all`, {
        headers: this.tokenHeaders,
        timeout: 10_000,
      })
      const count = response.data?.data?.shops?.length ?? 0
      return { success: true, message: `Kết nối GHN thành công - ${count} shop` }
    } catch (error) {
      return { success: false, message: `Lỗi kết nối GHN: ${providerError(error)}` }
    }
  }

  async execute(action: string, params: Record<string, unknown>) {
    switch (action) {
      case 'createOrder': {
        const response = await axios.post(
          `${this.baseUrl}/v2/shipping-order/create`,
          params.order ?? params,
          { headers: this.headers, timeout: 15_000 },
        )
        return { order: response.data?.data ?? {} }
      }
      case 'getTracking': {
        const response = await axios.post(
          `${this.baseUrl}/v2/shipping-order/detail`,
          { order_code: params.orderCode },
          { headers: this.headers, timeout: 10_000 },
        )
        return { tracking: response.data?.data ?? {} }
      }
      case 'cancelOrder': {
        const response = await axios.post(
          `${this.baseUrl}/v2/switch-status/cancel`,
          { order_codes: [params.orderCode] },
          { headers: this.headers, timeout: 10_000 },
        )
        return { success: true, data: response.data?.data }
      }
      case 'calculateFee': {
        const response = await axios.post(
          `${this.baseUrl}/v2/shipping-order/fee`,
          params,
          { headers: this.headers, timeout: 10_000 },
        )
        return { fee: response.data?.data ?? {} }
      }
      case 'getProvinces': {
        const response = await axios.get(`${this.baseUrl}/master-data/province`, {
          headers: this.tokenHeaders,
          timeout: 10_000,
        })
        return { provinces: response.data?.data ?? [] }
      }
      case 'getDistricts': {
        const response = await axios.get(`${this.baseUrl}/master-data/district`, {
          headers: this.tokenHeaders,
          params: { province_id: params.provinceId },
          timeout: 10_000,
        })
        return { districts: response.data?.data ?? [] }
      }
      case 'getWards': {
        const response = await axios.post(
          `${this.baseUrl}/master-data/ward`,
          { district_id: Number(params.districtId) },
          { headers: this.tokenHeaders, timeout: 10_000 },
        )
        return { wards: response.data?.data ?? [] }
      }
      case 'getServices': {
        const response = await axios.post(
          `${this.baseUrl}/v2/shipping-order/available-services`,
          {
            shop_id: Number(
              params.shopId ?? this.config.credentials.shopId,
            ),
            from_district: Number(
              params.fromDistrict ?? this.config.settings.fromDistrictId,
            ),
            to_district: Number(params.toDistrict),
          },
          { headers: this.tokenHeaders, timeout: 10_000 },
        )
        return { services: response.data?.data ?? [] }
      }
      default:
        throw new Error(`GHN không hỗ trợ action: ${action}`)
    }
  }
}
