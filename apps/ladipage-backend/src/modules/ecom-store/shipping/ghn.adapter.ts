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
      const response = await axios.post(`${this.baseUrl}/v2/shop/all`, {
        offset: 0,
        limit: 200,
        client_phone: '',
      }, {
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
        return { districts: this.activeLocations(response.data?.data, 'DistrictName') }
      }
      case 'getWards': {
        const districtId = Number(params.districtId)
        if (!Number.isInteger(districtId) || districtId <= 0) {
          throw new Error('GHN districtId không hợp lệ')
        }
        const response = await axios.post(
          `${this.baseUrl}/master-data/ward`,
          { district_id: districtId },
          {
            headers: this.tokenHeaders,
            params: { district_id: districtId },
            timeout: 10_000,
          },
        )
        return { wards: this.activeLocations(response.data?.data, 'WardName') }
      }
      case 'getServices': {
        const fromDistrict = await this.resolvePickupDistrict(params.fromDistrict)
        const toDistrict = Number(params.toDistrict)
        if (!Number.isInteger(fromDistrict) || fromDistrict <= 0) {
          throw new Error('GHN chưa cấu hình đúng ID quận/huyện lấy hàng')
        }
        if (!Number.isInteger(toDistrict) || toDistrict <= 0) {
          throw new Error('GHN districtId người nhận không hợp lệ')
        }
        const response = await axios.post(
          `${this.baseUrl}/v2/shipping-order/available-services`,
          {
            shop_id: Number(
              params.shopId ?? this.config.credentials.shopId,
            ),
            from_district: fromDistrict,
            to_district: toDistrict,
          },
          { headers: this.tokenHeaders, timeout: 10_000 },
        )
        return { services: response.data?.data ?? [] }
      }
      default:
        throw new Error(`GHN không hỗ trợ action: ${action}`)
    }
  }

  private activeLocations(value: unknown, nameKey: 'DistrictName' | 'WardName') {
    if (!Array.isArray(value)) return []
    const unique = new Map<string, Record<string, unknown>>()
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const location = item as Record<string, unknown>
      if (Number(location.Status ?? 1) !== 1) continue
      const code = String(location.WardCode ?? location.DistrictID ?? '')
      if (!code) continue
      const name = String(location[nameKey] ?? '').trim()
      if (!name) continue
      unique.set(code, { ...location, [nameKey]: name })
    }
    return [...unique.values()].sort((left, right) =>
      String(left[nameKey]).localeCompare(String(right[nameKey]), 'vi'),
    )
  }

  private async resolvePickupDistrict(explicitValue: unknown) {
    const explicit = Number(explicitValue)
    if (Number.isInteger(explicit) && explicit > 0) return explicit

    // The GHN shop is the source of truth after administrative-boundary
    // changes. This avoids keeping a stale district ID in LadiPage settings.
    const response = await axios.post(`${this.baseUrl}/v2/shop/all`, {
      offset: 0,
      limit: 200,
      client_phone: '',
    }, {
      headers: this.tokenHeaders,
      timeout: 10_000,
    })
    const shops = Array.isArray(response.data?.data?.shops)
      ? response.data.data.shops as Record<string, unknown>[]
      : []
    const shopId = Number(this.config.credentials.shopId)
    const shop = shops.find(item => Number(item._id ?? item.shop_id) === shopId)
    const liveDistrict = Number(shop?.district_id)
    if (Number.isInteger(liveDistrict) && liveDistrict > 0) return liveDistrict

    const configured = Number(this.config.settings.fromDistrictId)
    if (Number.isInteger(configured) && configured > 0) return configured
    throw new Error('GHN không tìm thấy quận/huyện lấy hàng của Shop ID đã cấu hình')
  }
}
