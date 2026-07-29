import { readFileSync } from 'node:fs'

import { getCommerceConfig } from '../commerce.config'

function formatFetchError(err: unknown, url: string): string {
  const parts: string[] = []
  if (err instanceof Error) {
    parts.push(err.message)
    const cause = (err as Error & { cause?: unknown }).cause
    if (cause instanceof Error) {
      parts.push(cause.message)
      const code = (cause as NodeJS.ErrnoException).code
      if (code) parts.push(`code=${code}`)
    }
    else if (cause && typeof cause === 'object') {
      const c = cause as { code?: string; message?: string }
      if (c.code) parts.push(`code=${c.code}`)
      if (c.message) parts.push(c.message)
    }
  }
  else {
    parts.push(String(err))
  }

  const joined = parts.filter(Boolean).join(' | ')
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(joined)) {
    return (
      `Cannot connect to Medusa at ${url} (${joined}). `
      + 'Browser can open localhost:9000 while Nest cannot if Nest runs in WSL/Docker '
      + 'and Medusa runs on Windows/host. Set MEDUSA_BACKEND_URL to the host IP '
      + '(WSL: ip from /etc/resolv.conf nameserver) and ensure Medusa listens 0.0.0.0:9000. '
      + 'Or run Nest on the same OS as Medusa. Dev without Medusa: COMMERCE_MEDUSA_MOCK=true.'
    )
  }
  if (/aborted|AbortError|timeout/i.test(joined)) {
    return `Medusa request timed out: ${url} (${joined})`
  }
  return `Medusa request failed: ${url} (${joined})`
}

/** Windows host IP as seen from WSL2 (nameserver in resolv.conf). */
export function getWslWindowsHostIp(): string | null {
  try {
    const text = readFileSync('/etc/resolv.conf', 'utf8')
    const m = text.match(/nameserver\s+(\S+)/)
    return m?.[1] ?? null
  }
  catch {
    return null
  }
}

/**
 * Candidate base URLs when connecting to Medusa.
 * Order: env as-is, 127.0.0.1, localhost, WSL host IP, host.docker.internal
 */
export function resolveMedusaBaseUrlCandidates(configured: string): string[] {
  const raw = (configured || 'http://127.0.0.1:9000').replace(/\/$/, '')
  const out: string[] = []
  const add = (u: string) => {
    const n = u.replace(/\/$/, '')
    if (n && !out.includes(n)) out.push(n)
  }

  add(raw)

  try {
    const u = new URL(raw)
    const port = u.port || '9000'
    const proto = u.protocol

    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      add(`${proto}//127.0.0.1:${port}`)
      add(`${proto}//localhost:${port}`)
      const wslHost = getWslWindowsHostIp()
      if (wslHost) add(`${proto}//${wslHost}:${port}`)
      add(`${proto}//host.docker.internal:${port}`)
    }
  }
  catch {
    /* keep raw only */
  }

  return out
}

export function normalizeMedusaBaseUrl(url: string): string {
  // Keep configured host; multi-candidate retry handles WSL/Docker
  return url.replace(/\/$/, '')
}

export type MedusaRequestResult<T = unknown> = {
  ok: boolean
  status: number
  data: T | null
  error?: string
  raw?: string
  url?: string
  baseUrlUsed?: string
}

/**
 * Thin HTTP client for Medusa Admin/Store.
 * Retries alternate base URLs on connection failure (WSL ↔ Windows Medusa).
 */
export class MedusaHttpClient {
  private baseUrls: string[]

  constructor(
    private readonly kind: 'admin' | 'store',
    baseUrlOrList: string | string[],
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {
    this.baseUrls = Array.isArray(baseUrlOrList)
      ? baseUrlOrList
      : resolveMedusaBaseUrlCandidates(baseUrlOrList)
  }

  static fromConfig(kind: 'admin' | 'store'): MedusaHttpClient {
    const cfg = getCommerceConfig()
    const key = kind === 'admin' ? cfg.adminApiKey : cfg.publishableKey
    const bases = resolveMedusaBaseUrlCandidates(cfg.medusaBaseUrl)
    return new MedusaHttpClient(kind, bases, key, cfg.timeoutMs)
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    authMode: 'basic' | 'bearer' = 'basic',
  ): Promise<MedusaRequestResult<T>> {
    let lastConnError: MedusaRequestResult<T> | null = null

    for (const base of this.baseUrls) {
      const result = await this.requestOnce<T>(method, path, body, authMode, base)
      if (result.ok) {
        return { ...result, baseUrlUsed: base }
      }
      // Connection-level failure → try next host
      if (result.status === 0) {
        lastConnError = { ...result, baseUrlUsed: base }
        continue
      }
      // HTTP error (401/400/…) — do not try other hosts; maybe retry auth
      if (
        this.kind === 'admin'
        && authMode === 'basic'
        && result.status === 401
      ) {
        return this.request<T>(method, path, body, 'bearer')
      }
      return { ...result, baseUrlUsed: base }
    }

    return (
      lastConnError ?? {
        ok: false,
        status: 0,
        data: null,
        error: `Cannot connect to Medusa (tried: ${this.baseUrls.join(', ')})`,
      }
    )
  }

  private async requestOnce<T>(
    method: string,
    path: string,
    body: unknown,
    authMode: 'basic' | 'bearer',
    baseUrl: string,
  ): Promise<MedusaRequestResult<T>> {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }

    if (this.kind === 'admin' && this.apiKey) {
      // Try both formats as Medusa v2 supports different auth
      if (authMode === 'bearer') {
        headers.Authorization = `Bearer ${this.apiKey}`
      }
      else {
        // Secret API key: Basic auth api_key:
        const basic = Buffer.from(`${this.apiKey}:`, 'utf8').toString('base64')
        headers.Authorization = `Basic ${basic}`
      }
    }
    if (this.kind === 'store' && this.apiKey) {
      headers['x-publishable-api-key'] = this.apiKey
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      const text = await res.text()
      let data: T | null = null
      if (text) {
        try {
          data = JSON.parse(text) as T
        }
        catch {
          data = null
        }
      }
      if (!res.ok) {
        const errMsg =
          (data as { message?: string } | null)?.message
          ?? text?.slice(0, 300)
          ?? `HTTP ${res.status}`
        return {
          ok: false,
          status: res.status,
          data,
          error: `Medusa ${this.kind} ${method} ${path} → ${res.status}: ${errMsg}`,
          raw: text?.slice(0, 500),
          url,
          baseUrlUsed: baseUrl,
        }
      }
      return { ok: true, status: res.status, data, raw: text, url, baseUrlUsed: baseUrl }
    }
    catch (err) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: formatFetchError(err, url),
        url,
        baseUrlUsed: baseUrl,
      }
    }
    finally {
      clearTimeout(timer)
    }
  }

  get<T = unknown>(path: string) {
    return this.request<T>('GET', path)
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body)
  }

  delete<T = unknown>(path: string) {
    return this.request<T>('DELETE', path)
  }
}
