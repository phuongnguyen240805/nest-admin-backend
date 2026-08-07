import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface ExternalResponse<T> {
  data?: T
  status?: string
  message?: string
  error?: string
}

function normalizeBase(value: string, fallback: string) {
  return (value || fallback).replace(/\/$/, '')
}

@Injectable()
export class LibreDeskClient {
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const baseUrl = normalizeBase(
      this.config.get<string>('CUSTOMER_CARE_LIBREDESK_BASE_URL') || '',
      'http://127.0.0.1:9001/api/v1',
    )
    const apiKey = this.config.get<string>('CUSTOMER_CARE_LIBREDESK_API_KEY') || ''
    const apiSecret = this.config.get<string>('CUSTOMER_CARE_LIBREDESK_API_SECRET') || ''
    const connectorToken = this.config.get<string>('CUSTOMER_CARE_ZALO_CONNECTOR_TOKEN') || ''
    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Customer Care LibreDesk credentials are not configured')
    }
    return { baseUrl, apiKey, apiSecret, connectorToken }
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { baseUrl, apiKey, apiSecret } = this.settings()
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: init.signal || AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new BadGatewayException(`Cannot connect to LibreDesk: ${error instanceof Error ? error.message : String(error)}`)
    }
    const raw = await response.text()
    const payload = raw ? safeJson(raw) : null
    if (!response.ok) {
      const message = payload?.message || payload?.error || `LibreDesk returned HTTP ${response.status}`
      throw new BadGatewayException(message)
    }
    return (payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) as T
  }

  async inbound<T>(payload: Record<string, unknown>): Promise<T> {
    const { baseUrl, connectorToken } = this.settings()
    if (!connectorToken) throw new ServiceUnavailableException('Zalo connector token is not configured')
    const response = await fetch(`${baseUrl}/channels/zalo/inbound`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Zalo-Connector-Token': connectorToken,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
    const raw = await response.text()
    const parsed = raw ? safeJson(raw) : null
    if (!response.ok) {
      throw new BadGatewayException(parsed?.message || `LibreDesk inbound returned HTTP ${response.status}`)
    }
    return (parsed?.data ?? parsed) as T
  }
}

@Injectable()
export class ZaloConnectorClient {
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const baseUrl = normalizeBase(
      this.config.get<string>('CUSTOMER_CARE_ZALO_CONNECTOR_URL') || '',
      'http://127.0.0.1:3100',
    )
    const token = this.config.get<string>('CUSTOMER_CARE_ZALO_CONNECTOR_TOKEN') || ''
    return { baseUrl, token }
  }

  async json<T>(path: string, init: RequestInit = {}, requireToken = false): Promise<T> {
    const { baseUrl, token } = this.settings()
    if (requireToken && !token) throw new ServiceUnavailableException('Zalo connector token is not configured')
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    if (requireToken) headers.set('x-zalo-connector-token', token)
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal || AbortSignal.timeout(20_000),
    })
    const raw = await response.text()
    const payload = raw ? safeJson(raw) : null
    if (!response.ok) throw new BadGatewayException(payload?.error || payload?.message || `Zalo connector returned HTTP ${response.status}`)
    return payload as T
  }

  async qr(): Promise<{ bytes: Buffer; contentType: string }> {
    const { baseUrl } = this.settings()
    const response = await fetch(`${baseUrl}/qr?t=${Date.now()}`, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) {
      const raw = await response.text()
      throw new BadGatewayException(safeJson(raw)?.error || `Zalo connector returned HTTP ${response.status}`)
    }
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'image/png',
    }
  }
}

function safeJson(raw: string): any {
  try { return JSON.parse(raw) } catch { return { message: raw } }
}
