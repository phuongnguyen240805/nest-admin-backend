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
    return this.coerceWebsite(body, input)
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
    opts?: { skipCircuit?: boolean },
  ): Promise<T> {
    if (!this.isEnabled()) {
      throw new UmamiUnavailableError('Umami is disabled')
    }

    if (!opts?.skipCircuit) {
      this.refreshCircuit()
      if (this.circuit.state === 'open') {
        throw new UmamiUnavailableError('Umami circuit open')
      }
    }

    const baseUrl = this.baseUrl
    if (!baseUrl) {
      throw new UmamiUnavailableError('UMAMI_BASE_URL is not configured')
    }

    const apiKey = this.configService.get<string>('UMAMI_API_KEY') ?? ''
    const timeoutMs = this.timeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(apiKey
            ? {
                authorization: `Bearer ${apiKey}`,
                'x-umami-api-key': apiKey,
              }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (response.status === 401 || response.status === 403) {
        this.recordFailure()
        throw new UmamiAuthError(`Umami auth failed: HTTP ${response.status}`)
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

  private coerceWebsite(
    body: Record<string, unknown>,
    input: { name: string; domain: string },
  ): UmamiWebsite {
    return {
      id: String(body.id ?? body.websiteId ?? ''),
      name: String(body.name ?? input.name),
      domain: String(body.domain ?? input.domain),
      shareId: body.shareId != null ? String(body.shareId) : null,
    }
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
