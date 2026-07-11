import { Inject, Injectable, Logger } from '@nestjs/common'

import { ILandingCmsConfig, LandingCmsConfig } from '../landing-cms.config'

export interface InstaticCreatePageResult {
  siteId: string
  pageId: string
}

export interface InstaticArtifactResult {
  html: string
  title: string
  description?: string
  etag: string
}

/**
 * Thin HTTP client for Instatic admin/CMS APIs.
 * Mock mode is the default when INSTATIC_MOCK is unset — keeps CI offline-safe.
 */
@Injectable()
export class InstaticClient {
  private readonly logger = new Logger(InstaticClient.name)

  constructor(
    @Inject(LandingCmsConfig.KEY)
    private readonly config: ILandingCmsConfig,
  ) {}

  get isMock(): boolean {
    return this.config.mock || !this.config.baseUrl
  }

  async health(): Promise<{ ok: boolean; version?: string }> {
    if (this.isMock) {
      return { ok: true, version: 'mock' }
    }

    try {
      const res = await fetch(`${this.config.baseUrl}/health`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) return { ok: false }
      const body = (await res.json().catch(() => ({}))) as { version?: string }
      return { ok: true, version: body.version }
    }
    catch (error) {
      this.logger.warn(`Instatic health failed: ${(error as Error).message}`)
      return { ok: false }
    }
  }

  async ensurePage(input: {
    siteKey: string
    pageKey: string
    title: string
    html?: string
  }): Promise<InstaticCreatePageResult> {
    if (this.isMock) {
      return {
        siteId: `site_${input.siteKey}`,
        pageId: `page_${input.pageKey}`,
      }
    }

    let res: Response
    try {
      res = await fetch(`${this.config.baseUrl}/admin/api/cms/ladipage/ensure-page`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(30_000),
      })
    }
    catch (error) {
      const cause = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Instatic ensure-page unreachable at ${this.config.baseUrl} (${cause}). ` +
          `If Nest runs in Docker, 127.0.0.1 is the container — use http://host.docker.internal:8787. ` +
          `Or set INSTATIC_MOCK=true for offline session mint.`,
      )
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      // Bridge may be missing on old Instatic process — do not fail the whole open flow.
      if (res.status === 404) {
        this.logger.warn(
          `Instatic ensure-page 404 at ${this.config.baseUrl} — using provisional ids. Restart Instatic with latest ladipageBridge routes.`,
        )
        return {
          siteId: input.siteKey || 'default',
          pageId: input.pageKey,
        }
      }
      throw new Error(`Instatic ensure-page failed (${res.status}): ${text.slice(0, 300)}`)
    }

    const data = (await res.json()) as { siteId?: string; pageId?: string; id?: string }
    return {
      siteId: data.siteId ?? input.siteKey,
      pageId: data.pageId ?? data.id ?? input.pageKey,
    }
  }

  async importHtml(input: {
    siteId: string
    pageId: string
    html: string
    title?: string
  }): Promise<InstaticCreatePageResult> {
    if (this.isMock) {
      return { siteId: input.siteId, pageId: input.pageId }
    }

    const res = await fetch(`${this.config.baseUrl}/admin/api/cms/ladipage/import-html`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Instatic import-html failed (${res.status}): ${text.slice(0, 300)}`)
    }

    return { siteId: input.siteId, pageId: input.pageId }
  }

  async fetchPublishedArtifact(input: {
    siteId: string
    pageId: string
  }): Promise<InstaticArtifactResult> {
    if (this.isMock) {
      const title = `Mock page ${input.pageId}`
      const html = [
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        `<title>${title}</title></head>`,
        `<body data-lp-page="${input.pageId}" data-instatic-mock="1">`,
        `<main><h1>${title}</h1><p>Instatic mock artifact.</p></main>`,
        '</body></html>',
      ].join('')
      return {
        html,
        title,
        description: 'Mock Instatic artifact',
        etag: `mock-${input.pageId}`,
      }
    }

    const url =
      `${this.config.baseUrl}/admin/api/cms/ladipage/pages/` +
      `${encodeURIComponent(input.pageId)}/artifact` +
      `?siteId=${encodeURIComponent(input.siteId)}`

    const res = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Instatic artifact failed (${res.status}): ${text.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      html: string
      title?: string
      description?: string
      etag?: string
    }

    if (!data.html) {
      throw new Error('Instatic artifact response missing html')
    }

    return {
      html: data.html,
      title: data.title ?? input.pageId,
      description: data.description,
      etag: data.etag ?? res.headers.get('etag') ?? `etag-${input.pageId}`,
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (this.config.adminToken) {
      headers.Authorization = `Bearer ${this.config.adminToken}`
    }
    return headers
  }
}
