import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

interface AutomationHttpResult extends Record<string, unknown> {
  status: number
  ok: boolean
  contentType: string | null
  body: unknown
}

export class AutomationHttpActionError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message)
    this.name = 'AutomationHttpActionError'
  }
}

@Injectable()
export class AutomationHttpActionService {
  async request(payload: Record<string, unknown>, dispatchId: string, webhook = false): Promise<AutomationHttpResult> {
    if (process.env.AUTOMATION_HTTP_ENABLED !== 'true') {
      throw new BadRequestException('Automation HTTP actions are disabled')
    }

    const url = this.parseUrl(payload.url)
    await this.assertAllowedUrl(url)

    const method = this.method(payload.method ?? (webhook ? 'POST' : 'GET'))
    const timeoutMs = this.int(payload.timeoutMs, 15_000, 1_000, 30_000)
    const maxResponseBytes = this.int(
      process.env.AUTOMATION_HTTP_MAX_RESPONSE_BYTES,
      512 * 1024,
      1_024,
      2 * 1024 * 1024,
    )
    const headers = this.safeHeaders(payload.headers)
    const explicitIdempotencyKey = this.string(payload.idempotencyKey)
    const idempotencyKey = explicitIdempotencyKey || `automation:${dispatchId}`
    const body = this.requestBody(method, payload.body, headers)

    if (!['GET', 'HEAD'].includes(method) && !headers.has('idempotency-key')) {
      headers.set('idempotency-key', idempotencyKey)
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })

      const declaredLength = Number(response.headers.get('content-length') ?? 0)
      if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
        throw new AutomationHttpActionError('Automation HTTP response is too large', false)
      }

      const text = await response.text()
      if (Buffer.byteLength(text, 'utf8') > maxResponseBytes) {
        throw new AutomationHttpActionError('Automation HTTP response is too large', false)
      }

      const contentType = response.headers.get('content-type')
      const parsed = this.parseResponse(text, contentType)
      if (!response.ok) {
        const retryableStatus = response.status === 408 || response.status === 429 || response.status >= 500
        const retryableMethod = ['GET', 'HEAD', 'PUT', 'DELETE'].includes(method) || Boolean(explicitIdempotencyKey)
        throw new AutomationHttpActionError(
          `Automation HTTP request failed with status ${response.status}`,
          retryableStatus && retryableMethod,
        )
      }

      return {
        status: response.status,
        ok: true,
        contentType,
        body: parsed,
      }
    } catch (error) {
      if (error instanceof AutomationHttpActionError) throw error
      const retryableMethod = ['GET', 'HEAD', 'PUT', 'DELETE'].includes(method) || Boolean(explicitIdempotencyKey)
      const message = error instanceof Error ? error.message : String(error)
      throw new AutomationHttpActionError(`Automation HTTP request failed: ${message}`, retryableMethod)
    }
  }

  private parseUrl(value: unknown): URL {
    const raw = this.string(value)
    if (!raw) throw new BadRequestException('HTTP action url is required')
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new BadRequestException('HTTP action url is invalid')
    }
    if (url.username || url.password) throw new BadRequestException('HTTP action url credentials are not allowed')
    const allowHttp = process.env.AUTOMATION_HTTP_ALLOW_INSECURE === 'true'
    if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
      throw new BadRequestException('HTTP action requires HTTPS')
    }
    return url
  }

  private async assertAllowedUrl(url: URL): Promise<void> {
    const allowed = String(process.env.AUTOMATION_HTTP_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    if (!allowed.length) throw new ServiceUnavailableException('AUTOMATION_HTTP_ALLOWED_HOSTS is not configured')

    const host = url.hostname.toLowerCase()
    const allowedHost = allowed.some((rule) => rule.startsWith('*.')
      ? host.endsWith(rule.slice(1)) && host !== rule.slice(2)
      : host === rule)
    if (!allowedHost) throw new BadRequestException('HTTP action host is not allowlisted')
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      throw new BadRequestException('Local HTTP action targets are not allowed')
    }

    if (isIP(host)) {
      if (this.isPrivateIp(host)) throw new BadRequestException('Private HTTP action targets are not allowed')
      return
    }

    const addresses = await lookup(host, { all: true, verbatim: true }).catch(() => [])
    if (!addresses.length) throw new BadRequestException('HTTP action host cannot be resolved')
    if (addresses.some(({ address }) => this.isPrivateIp(address))) {
      throw new BadRequestException('HTTP action host resolves to a private address')
    }
  }

  private isPrivateIp(address: string): boolean {
    if (address === '::1' || address === '0.0.0.0' || address === '::') return true
    const lower = address.toLowerCase()
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
    if (!address.includes('.')) return false
    const parts = address.split('.').map(Number)
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true
    const [a, b] = parts
    return a === 10
      || a === 127
      || a === 0
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)
  }

  private method(value: unknown): string {
    const method = String(value ?? '').trim().toUpperCase()
    const allowed = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
    if (!allowed.has(method)) throw new BadRequestException('HTTP action method is not allowed')
    return method
  }

  private safeHeaders(value: unknown): Headers {
    const blocked = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'cookie'])
    const headers = new Headers()
    const entries: Array<[string, unknown]> = Array.isArray(value)
      ? value.map((item) => {
          const row = this.record(item)
          return [this.string(row.key), row.value] as [string, unknown]
        })
      : Object.entries(this.record(value))

    for (const [key, raw] of entries) {
      const name = key.trim().toLowerCase()
      if (!name || blocked.has(name)) continue
      const text = this.string(raw)
      if (!text || text.length > 8_192) continue
      headers.set(name, text)
    }
    return headers
  }

  private requestBody(method: string, value: unknown, headers: Headers): string | undefined {
    if (method === 'GET' || method === 'HEAD' || value === undefined || value === null) return undefined
    if (typeof value === 'string') return value

    const body = this.record(value)
    const bodyType = this.string(body.bodyType)
    if (bodyType === 'allContactData') {
      throw new BadRequestException('allContactData HTTP body requires an explicit Ladipage mapping and is not enabled implicitly')
    }
    if (bodyType === 'json') {
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
      const jsonBody = this.string(body.jsonBody)
      if (!jsonBody) return '{}'
      try { JSON.parse(jsonBody) } catch { throw new BadRequestException('HTTP action jsonBody is invalid JSON') }
      return jsonBody
    }
    if (bodyType === 'formEncoded') {
      if (!headers.has('content-type')) headers.set('content-type', 'application/x-www-form-urlencoded')
      const params = new URLSearchParams()
      for (const item of Array.isArray(body.formFields) ? body.formFields : []) {
        const row = this.record(item)
        const key = this.string(row.key)
        if (key) params.append(key, this.string(row.value))
      }
      return params.toString()
    }

    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    return JSON.stringify(value)
  }

  private parseResponse(text: string, contentType: string | null): unknown {
    if (!text) return null
    if (contentType?.toLowerCase().includes('json')) {
      try { return JSON.parse(text) } catch { return text }
    }
    return text
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  }

  private int(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
