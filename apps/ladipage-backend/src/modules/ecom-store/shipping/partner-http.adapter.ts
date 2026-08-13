import axios, { type AxiosRequestConfig, type Method } from 'axios'

import {
  providerError,
  ShippingAdapter,
  type ShippingIntegrationConfig,
  type ShippingTestResult,
} from './shipping-adapter'
import type { ShippingProvider } from './core'

type ActionName = 'test' | 'calculateFee' | 'createOrder' | 'getTracking' | 'cancelOrder'

/**
 * Contract-driven adapter for carriers whose production contract supplies
 * tenant-specific hosts/paths. It deliberately requires configured endpoints
 * where the carrier does not publish a stable public API.
 */
export class PartnerHttpShippingAdapter extends ShippingAdapter {
  constructor(
    config: ShippingIntegrationConfig,
    readonly provider: ShippingProvider,
    readonly name: string,
  ) {
    super(config)
  }

  async testConnection(): Promise<ShippingTestResult> {
    try {
      const path = this.path('test', false)
      if (!path) {
        return {
          success: false,
          message: `${this.name}: cần cấu hình endpoint kiểm tra kết nối do hãng cấp trong hợp đồng API`,
        }
      }
      await this.request('test', {})
      return { success: true, message: `Kết nối ${this.name} thành công` }
    } catch (error) {
      return { success: false, message: `Lỗi kết nối ${this.name}: ${providerError(error)}` }
    }
  }

  async execute(action: string, params: Record<string, unknown>) {
    if (!['calculateFee', 'createOrder', 'getTracking', 'cancelOrder'].includes(action)) {
      throw new Error(`${this.name} không hỗ trợ action: ${action}`)
    }
    const data = await this.request(action as ActionName, params)
    if (action === 'calculateFee') return { fee: this.unwrap(data, ['fee', 'data', 'result']) }
    if (action === 'createOrder') return { order: this.unwrap(data, ['order', 'data', 'result']) }
    if (action === 'getTracking') return { tracking: this.unwrap(data, ['tracking', 'data', 'result']) }
    return { success: true, data }
  }

  private async request(action: ActionName, params: Record<string, unknown>) {
    const url = new URL(this.interpolate(this.path(action), params), this.baseUrl()).toString()
    const method = this.method(action)
    const headers = this.headers(params)
    const payload = this.payload(params)
    const request: AxiosRequestConfig = {
      url,
      method,
      headers,
      timeout: 15_000,
      ...(method === 'GET' ? { params: payload } : { data: payload }),
    }
    const response = await axios.request(request)
    return response.data as Record<string, unknown>
  }

  private baseUrl() {
    const configured = String(this.config.settings.baseUrl ?? '').trim()
    const value = configured
    if (!value) throw new Error(`${this.name}: thiếu baseUrl API do hãng cấp`)
    return value.endsWith('/') ? value : `${value}/`
  }

  private path(action: ActionName, required = true) {
    const endpoints = (this.config.settings.endpoints ?? {}) as Record<string, unknown>
    const configured = String(endpoints[action] ?? '').trim()
    const value = configured
    if (!value && required) throw new Error(`${this.name}: thiếu endpoint ${action}`)
    return value ?? ''
  }

  private method(action: ActionName): Method {
    const methods = (this.config.settings.methods ?? {}) as Record<string, unknown>
    return String(methods[action] ?? (action === 'getTracking' || action === 'test' ? 'GET' : 'POST')).toUpperCase() as Method
  }

  private headers(params: Record<string, unknown>) {
    const configured = (this.config.settings.headers ?? {}) as Record<string, string>
    const token = this.config.credentials.token
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...configured }
    if (token) {
      const header = String(this.config.settings.tokenHeader ?? 'Token')
      const prefix = String(this.config.settings.tokenPrefix ?? '')
      headers[header] = `${prefix}${token}`
    }
    return headers
  }

  private payload(params: Record<string, unknown>) {
    return {
      ...params,
      customerCode: params.customerCode ?? this.config.credentials.customerCode,
      username: params.username ?? this.config.credentials.username,
    }
  }

  private interpolate(path: string, params: Record<string, unknown>) {
    const trackingCode = encodeURIComponent(String(params.trackingCode ?? params.orderCode ?? ''))
    return path.replace('{trackingCode}', trackingCode)
  }

  private unwrap(value: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      if (value?.[key] && typeof value[key] === 'object') return value[key] as Record<string, unknown>
    }
    return value
  }
}
