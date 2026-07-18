import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export class UmamiUnavailableError extends Error {
  readonly code = 'UMAMI_UNAVAILABLE' as const

  constructor(message: string) {
    super(message)
    this.name = 'UmamiUnavailableError'
  }
}

export class UmamiAuthError extends Error {
  readonly code = 'UMAMI_AUTH' as const

  constructor(message: string) {
    super(message)
    this.name = 'UmamiAuthError'
  }
}

export class UmamiNotFoundError extends Error {
  readonly code = 'UMAMI_NOT_FOUND' as const

  constructor(message: string) {
    super(message)
    this.name = 'UmamiNotFoundError'
  }
}

export type UmamiWebsite = {
  id: string
  name: string
  domain: string
  shareId?: string | null
}

export type UmamiStats = {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
  totaltime: number
}

export type UmamiMetricRow = {
  x: string
  y: number
}

export type UmamiPageviewPoint = {
  x: string
  y: number
}

export type UmamiCircuitState = 'closed' | 'open' | 'half_open'

type CircuitBucket = {
  failures: number
  openedAt: number | null
  state: UmamiCircuitState
}

@Injectable()
export class UmamiClientService {
  private readonly logger = new Logger(UmamiClientService.name)
  private readonly circuit: CircuitBucket = {
    failures: 0,
    openedAt: null,
    state: 'closed',
  }

  /** Cached login token for self-hosted Umami (no API-keys UI). */
  private sessionToken: string | null = null

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    const raw = this.configService.get<string>('UMAMI_ENABLED')
    if (raw === undefined || raw === null || raw === '') return false
    return raw === 'true' || raw === '1'
  }

  getCircuitState(): UmamiCircuitState {
    this.refreshCircuit()
    return this.circuit.state
  }

  async healthCheck(): Promise<{ ok: boolean; circuit: UmamiCircuitState; latencyMs?: number }> {
    if (!this.isEnabled()) {
      return { ok: false, circuit: this.getCircuitState() }
    }

    const started = Date.now()
    try {
      await this.request('GET', '/api/heartbeat', undefined, { skipCircuit: true })
      this.recordSuccess()
      return { ok: true, circuit: this.getCircuitState(), latencyMs: Date.now() - started }
    } catch {
      try {
        await this.request('GET', '/api/auth/verify', undefined, { skipCircuit: true })
        this.recordSuccess()
        return { ok: true, circuit: this.getCircuitState(), latencyMs: Date.now() - started }
      } catch {
        return { ok: false, circuit: this.getCircuitState(), latencyMs: Date.now() - started }
      }
    }
  }

  async createWebsite(input: { name: string; domain: string }): Promise<UmamiWebsite> {
    const body = await this.request<Record<string, unknown>>('POST', '/api/websites', {
      name: input.name,
      domain: input.domain,
    })
    const website = this.coerceWebsite(body, input)
    if (!website.id) {
      throw new UmamiUnavailableError('Umami createWebsite returned empty id')
    }
    return website
  }

  /** List websites (admin API); used to reuse existing domain mapping. */
  async listWebsites(): Promise<UmamiWebsite[]> {
    const body = await this.request<unknown>('GET', '/api/websites')
    const rows = this.asArray(body)
    return rows.map((row) =>
      this.coerceWebsite((row ?? {}) as Record<string, unknown>, { name: '', domain: '' }),
    ).filter((w) => Boolean(w.id))
  }

  async findWebsiteByDomain(domain: string): Promise<UmamiWebsite | null> {
    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    try {
      const list = await this.listWebsites()
      return (
        list.find((w) => {
          const d = (w.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
          return d === normalized || d.endsWith(`.${normalized}`) || normalized.endsWith(`.${d}`)
        }) ?? null
      )
    } catch {
      return null
    }
  }

  async getWebsite(websiteId: string): Promise<UmamiWebsite> {
    const body = await this.request<Record<string, unknown>>(
      'GET',
      `/api/websites/${encodeURIComponent(websiteId)}`,
    )
    return this.coerceWebsite(body, { name: '', domain: '' })
  }

  async getStats(
    websiteId: string,
    range: { startAt: number; endAt: number },
  ): Promise<UmamiStats> {
    const query = new URLSearchParams({
      startAt: String(range.startAt),
      endAt: String(range.endAt),
    })
    const body = await this.request<Record<string, unknown>>(
      'GET',
      `/api/websites/${encodeURIComponent(websiteId)}/stats?${query}`,
    )
    return {
      pageviews: this.metricValue(body.pageviews),
      visitors: this.metricValue(body.visitors),
      visits: this.metricValue(body.visits),
      bounces: this.metricValue(body.bounces),
      totaltime: this.metricValue(body.totaltime),
    }
  }

  async getMetrics(
    websiteId: string,
    type: string,
    range: { startAt: number; endAt: number },
  ): Promise<UmamiMetricRow[]> {
    const query = new URLSearchParams({
      type,
      startAt: String(range.startAt),
      endAt: String(range.endAt),
    })
    const body = await this.request<unknown>(
      'GET',
      `/api/websites/${encodeURIComponent(websiteId)}/metrics?${query}`,
    )
    if (!Array.isArray(body)) return []
    return body.map((row) => {
      const record = (row ?? {}) as Record<string, unknown>
      return {
        x: String(record.x ?? record.name ?? ''),
        y: Number(record.y ?? record.value ?? 0) || 0,
      }
    })
  }

  async getPageviews(
    websiteId: string,
    range: { startAt: number; endAt: number; unit?: string },
  ): Promise<UmamiPageviewPoint[]> {
    const query = new URLSearchParams({
      startAt: String(range.startAt),
      endAt: String(range.endAt),
      unit: range.unit ?? 'day',
    })
    const body = await this.request<unknown>(
      'GET',
      `/api/websites/${encodeURIComponent(websiteId)}/pageviews?${query}`,
    )
    const series = Array.isArray(body)
      ? body
      : Array.isArray((body as Record<string, unknown>)?.pageviews)
        ? ((body as Record<string, unknown>).pageviews as unknown[])
        : []

    return series.map((row) => {
      const record = (row ?? {}) as Record<string, unknown>
      return {
        x: String(record.x ?? record.t ?? record.date ?? ''),
        y: Number(record.y ?? record.views ?? 0) || 0,
      }
    })
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    opts?: { skipCircuit?: boolean; skipAuth?: boolean; isRetry?: boolean },
  ): Promise<T> {
    if (!this.isEnabled()) {
      throw new UmamiUnavailableError('Umami is disabled')
    }

    if (!opts?.skipCircuit) {
      this.refreshCircuit()
      if (this.circuit.state === 'open') {
        throw new UmamiUnavailableError(
          'Umami circuit open (too many recent failures). Wait ~60s or restart Nest. Check UMAMI_BASE_URL (host: http://localhost:7004, in-docker: http://umami:3000), UMAMI_USERNAME/PASSWORD (admin/umami).',
        )
      }
    }

    const baseUrl = this.baseUrl
    if (!baseUrl) {
      throw new UmamiUnavailableError('UMAMI_BASE_URL is not configured')
    }

    const token = opts?.skipAuth ? '' : await this.resolveAuthToken()
    const timeoutMs = this.timeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...this.authHeaders(token),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if ((response.status === 401 || response.status === 403) && !opts?.skipAuth && !opts?.isRetry) {
        // Session expired — clear cache, login again once
        this.sessionToken = null
        return this.request<T>(method, path, body, { ...opts, isRetry: true })
      }

      if (response.status === 401 || response.status === 403) {
        this.recordFailure()
        throw new UmamiAuthError(
          `Umami auth failed: HTTP ${response.status}. Self-host has no API keys UI — set UMAMI_USERNAME/UMAMI_PASSWORD (default admin/umami) or paste a login token into UMAMI_API_KEY.`,
        )
      }

      if (response.status === 404) {
        this.recordFailure()
        throw new UmamiNotFoundError(`Umami resource not found: ${path}`)
      }

      if (!response.ok) {
        this.recordFailure()
        throw new UmamiUnavailableError(`Umami HTTP ${response.status}`)
      }

      const text = await response.text()
      const parsed = text ? (JSON.parse(text) as T) : ({} as T)
      if (!opts?.skipCircuit) this.recordSuccess()
      return parsed
    } catch (error) {
      if (
        error instanceof UmamiUnavailableError
        || error instanceof UmamiAuthError
        || error instanceof UmamiNotFoundError
      ) {
        throw error
      }

      this.recordFailure()
      const message = error instanceof Error ? error.message : 'Umami request failed'
      this.logger.warn(`Umami request error: ${message}`)
      throw new UmamiUnavailableError(message)
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Self-hosted Umami often has NO "API keys" settings page (Cloud-only).
   * Auth order:
   * 1) UMAMI_API_KEY if set (static key or pasted login token)
   * 2) Login with UMAMI_USERNAME / UMAMI_PASSWORD → cache token
   */
  private async resolveAuthToken(): Promise<string> {
    const staticKey = this.resolveStaticApiKey()
    if (staticKey) return staticKey

    if (this.sessionToken) return this.sessionToken

    const username = (this.configService.get<string>('UMAMI_USERNAME') ?? 'admin').trim()
    const password = (this.configService.get<string>('UMAMI_PASSWORD') ?? 'umami').trim()

    if (!username || !password) {
      throw new UmamiAuthError(
        'Umami auth not configured. Self-host has no API keys menu — set UMAMI_USERNAME + UMAMI_PASSWORD, or paste token from POST /api/auth/login into UMAMI_API_KEY.',
      )
    }

    this.assertAsciiHeaderValue(password, 'UMAMI_PASSWORD')
    this.assertAsciiHeaderValue(username, 'UMAMI_USERNAME')

    try {
      const body = await this.request<Record<string, unknown>>(
        'POST',
        '/api/auth/login',
        { username, password },
        { skipAuth: true, skipCircuit: true },
      )
      const token = String(body.token ?? body.access_token ?? '')
      if (!token) {
        throw new UmamiAuthError('Umami login returned empty token')
      }
      this.assertAsciiHeaderValue(token, 'Umami login token')
      this.sessionToken = token
      this.logger.log('Umami session token acquired via username/password login')
      return token
    } catch (error) {
      if (error instanceof UmamiAuthError || error instanceof UmamiUnavailableError) throw error
      const message = error instanceof Error ? error.message : 'login failed'
      throw new UmamiAuthError(`Umami login failed: ${message}`)
    }
  }

  private coerceWebsite(
    body: Record<string, unknown>,
    input: { name: string; domain: string },
  ): UmamiWebsite {
    const nested =
      body.data && typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : body
    const record = nested.result && typeof nested.result === 'object'
      ? (nested.result as Record<string, unknown>)
      : nested

    return {
      id: String(record.id ?? record.websiteId ?? record.website_id ?? ''),
      name: String(record.name ?? input.name),
      domain: String(record.domain ?? input.domain),
      shareId: record.shareId != null
        ? String(record.shareId)
        : record.share_id != null
          ? String(record.share_id)
          : null,
    }
  }

  private asArray(body: unknown): unknown[] {
    if (Array.isArray(body)) return body
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>
      if (Array.isArray(record.data)) return record.data
      if (Array.isArray(record.websites)) return record.websites
      if (Array.isArray(record.results)) return record.results
    }
    return []
  }

  private metricValue(value: unknown): number {
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const nested = record.value ?? record.y ?? record.count
      const parsed = Number(nested)
      return Number.isFinite(parsed) ? parsed : 0
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private recordSuccess(): void {
    this.circuit.failures = 0
    this.circuit.openedAt = null
    this.circuit.state = 'closed'
  }

  private recordFailure(): void {
    this.circuit.failures += 1
    const threshold = this.failureThreshold
    if (this.circuit.failures >= threshold) {
      this.circuit.state = 'open'
      this.circuit.openedAt = Date.now()
    }
  }

  private refreshCircuit(): void {
    if (this.circuit.state !== 'open' || this.circuit.openedAt == null) return
    if (Date.now() - this.circuit.openedAt >= this.circuitOpenMs) {
      this.circuit.state = 'half_open'
      this.circuit.failures = 0
    }
  }

  /**
   * Optional static credential (Cloud API key or pasted login token).
   * Empty → fall back to username/password login (self-host default).
   */
  private resolveStaticApiKey(): string {
    const raw = (this.configService.get<string>('UMAMI_API_KEY') ?? '').trim()
    if (!raw) return ''

    const key = raw.replace(/^Bearer\s+/i, '').trim()

    if (
      (key.startsWith('<') && key.endsWith('>'))
      || /replace-with|your-.*-key|xxx|todo|tạo trong/i.test(key)
    ) {
      this.logger.warn('UMAMI_API_KEY looks like a placeholder — ignoring, will use username/password login')
      return ''
    }

    try {
      this.assertAsciiHeaderValue(key, 'UMAMI_API_KEY')
    } catch {
      this.logger.warn('UMAMI_API_KEY has non-ASCII characters — ignoring, will use username/password login')
      return ''
    }

    return key
  }

  private assertAsciiHeaderValue(value: string, label: string): void {
    for (let i = 0; i < value.length; i += 1) {
      if (value.charCodeAt(i) > 255) {
        throw new UmamiAuthError(
          `${label} contains non-ASCII at index ${i} (charCode ${value.charCodeAt(i)}). HTTP headers only allow ASCII.`,
        )
      }
    }
  }

  private authHeaders(token: string): Record<string, string> {
    if (!token) return {}
    // Self-host login token uses Authorization Bearer.
    // Cloud API keys also accept x-umami-api-key — send both safely (ASCII validated).
    return {
      authorization: `Bearer ${token}`,
      'x-umami-api-key': token,
    }
  }

  private get baseUrl(): string {
    const raw = this.configService.get<string>('UMAMI_BASE_URL') ?? ''
    return raw.replace(/\/$/, '')
  }

  private get timeoutMs(): number {
    const parsed = Number(this.configService.get<string>('UMAMI_TIMEOUT_MS') ?? 3000)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000
  }

  private get failureThreshold(): number {
    const parsed = Number(this.configService.get<string>('UMAMI_CIRCUIT_FAILURE_THRESHOLD') ?? 5)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5
  }

  private get circuitOpenMs(): number {
    const parsed = Number(this.configService.get<string>('UMAMI_CIRCUIT_OPEN_MS') ?? 60_000)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000
  }
}
