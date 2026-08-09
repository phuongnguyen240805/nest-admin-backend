import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface ExternalResponse<T> {
  data?: T
  status?: string
  message?: string
  error?: string
}

export interface LibreDeskMedia {
  id: number
  uuid: string
  filename: string
  content_type: string
  size: number
  url?: string
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
    // Let fetch generate the multipart Content-Type (including its boundary).
    // Treating every request body as JSON corrupts FormData uploads and makes
    // LibreDesk's multipart parser reject otherwise valid files.
    const isMultipart =
      typeof FormData !== 'undefined' && init.body instanceof FormData
    if (init.body && !isMultipart && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json')
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

  async upload(file: { filename: string; mimetype: string; toBuffer(): Promise<Buffer> }): Promise<LibreDeskMedia> {
    const bytes = await file.toBuffer()
    const form = new FormData()
    form.append('files', new Blob([bytes], { type: file.mimetype || 'application/octet-stream' }), file.filename)
    return this.request<LibreDeskMedia>('/media', { method: 'POST', body: form })
  }

  async inbound<T>(payload: Record<string, unknown>, provider = 'zalo_personal'): Promise<T> {
    const { baseUrl, connectorToken: zaloToken } = this.settings()
    const facebook = provider === 'facebook_personal'
    const connectorToken = facebook
      ? this.config.get<string>('CUSTOMER_CARE_FACEBOOK_CONNECTOR_TOKEN') || zaloToken
      : zaloToken
    if (!connectorToken) throw new ServiceUnavailableException(`${facebook ? 'Facebook' : 'Zalo'} connector token is not configured`)
    const response = await fetch(`${baseUrl}/channels/${facebook ? 'facebook' : 'zalo'}/inbound`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [facebook ? 'X-Facebook-Connector-Token' : 'X-Zalo-Connector-Token']: connectorToken,
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
export class FacebookConnectorClient {
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const baseUrl = normalizeBase(
      this.config.get<string>('CUSTOMER_CARE_FACEBOOK_CONNECTOR_URL') || '',
      'http://127.0.0.1:3200',
    )
    const token = this.config.get<string>('CUSTOMER_CARE_FACEBOOK_CONNECTOR_TOKEN')
      || this.config.get<string>('CUSTOMER_CARE_ZALO_CONNECTOR_TOKEN') || ''
    return { baseUrl, token }
  }

  async json<T>(path: string, init: RequestInit = {}, requireToken = true): Promise<T> {
    const { baseUrl, token } = this.settings()
    if (requireToken && !token) throw new ServiceUnavailableException('Facebook connector token is not configured')
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    if (requireToken) headers.set('x-facebook-connector-token', token)
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: init.signal || AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new BadGatewayException(`Cannot connect to Facebook connector: ${error instanceof Error ? error.message : String(error)}`)
    }
    const raw = await response.text()
    const payload = raw ? safeJson(raw) : null
    if (!response.ok) throw new BadGatewayException(payload?.error || payload?.message || `Facebook connector returned HTTP ${response.status}`)
    return payload as T
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

  async qr(connectionKey: string): Promise<{ bytes: Buffer; contentType: string }> {
    const { baseUrl, token } = this.settings()
    const response = await fetch(`${baseUrl}/sessions/${encodeURIComponent(connectionKey)}/qr?t=${Date.now()}`, {
      headers: token ? { 'x-zalo-connector-token': token } : undefined,
      signal: AbortSignal.timeout(20_000),
    })
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
