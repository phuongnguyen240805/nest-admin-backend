import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { SeoProjectEntity } from '../entities'
import { AiSeoCacheService } from './ai-seo-cache.service'
import {
  UmamiAuthError,
  UmamiClientService,
  UmamiNotFoundError,
  UmamiStats,
  UmamiUnavailableError,
} from './umami-client.service'

export type TrafficRange = '7d' | '30d'
export type TrafficMetricType = 'referrer' | 'url' | 'device' | 'country' | 'event'
export type TrafficStatus = 'ok' | 'degraded' | 'not_configured' | 'disabled'

export type TrafficEnvelope<T> = {
  status: TrafficStatus
  stale: boolean
  syncedAt: string | null
  range: { start: string; end: string } | null
  data: T | null
  message?: string
}

@Injectable()
export class AiSeoTrafficService extends TenantScopedService {
  private readonly logger = new Logger(AiSeoTrafficService.name)

  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    private readonly umamiClient: UmamiClientService,
    private readonly cacheService: AiSeoCacheService,
    private readonly configService: ConfigService,
  ) {
    super(tenantContext)
  }

  health() {
    if (!this.umamiClient.isEnabled()) {
      return { ok: false, circuit: this.umamiClient.getCircuitState(), enabled: false }
    }
    return this.umamiClient.healthCheck().then((result) => ({
      ...result,
      enabled: true,
    }))
  }

  async getProjectTraffic(projectId: string, range: TrafficRange = '7d') {
    const project = await this.findProjectOrFail(projectId)
    const window = this.toRange(range)

    if (!this.umamiClient.isEnabled()) {
      return this.envelope('disabled', null, window, false, null, 'Umami is disabled')
    }

    if (!project.umamiWebsiteId) {
      return this.envelope('not_configured', null, window, false, null, 'Umami website is not provisioned')
    }

    const cacheKey = this.cacheKey(project.tenantId, project.id, 'stats', range)
    const staleKey = `${cacheKey}:stale`
    const cached = this.cacheService.get<UmamiStats>(cacheKey)
    if (cached) {
      return this.envelope('ok', cached, window, false, project.trafficSyncedAt)
    }

    try {
      const stats = await this.umamiClient.getStats(project.umamiWebsiteId, window.epoch)
      this.cacheService.set(cacheKey, stats, this.cacheTtlSeconds)
      this.cacheService.set(staleKey, stats, this.staleTtlSeconds)
      await this.markSynced(project, stats)
      return this.envelope('ok', stats, window, false, new Date())
    } catch (error) {
      return this.degradedFromError(error, staleKey, window, project.trafficSyncedAt, project.trafficSnapshot)
    }
  }

  async getProjectMetrics(projectId: string, type: TrafficMetricType, range: TrafficRange = '7d') {
    const project = await this.findProjectOrFail(projectId)
    const window = this.toRange(range)

    if (!this.umamiClient.isEnabled()) {
      return this.envelope('disabled', null, window, false, null, 'Umami is disabled')
    }
    if (!project.umamiWebsiteId) {
      return this.envelope('not_configured', null, window, false, null, 'Umami website is not provisioned')
    }

    const cacheKey = this.cacheKey(project.tenantId, project.id, `metrics:${type}`, range)
    const staleKey = `${cacheKey}:stale`
    const cached = this.cacheService.get<unknown>(cacheKey)
    if (cached) {
      return this.envelope('ok', cached, window, false, project.trafficSyncedAt)
    }

    try {
      const metrics = await this.umamiClient.getMetrics(project.umamiWebsiteId, type, window.epoch)
      this.cacheService.set(cacheKey, metrics, this.cacheTtlSeconds)
      this.cacheService.set(staleKey, metrics, this.staleTtlSeconds)
      return this.envelope('ok', metrics, window, false, new Date())
    } catch (error) {
      return this.degradedFromError(error, staleKey, window, project.trafficSyncedAt)
    }
  }

  async getProjectTimeseries(projectId: string, range: TrafficRange = '7d') {
    const project = await this.findProjectOrFail(projectId)
    const window = this.toRange(range)

    if (!this.umamiClient.isEnabled()) {
      return this.envelope('disabled', null, window, false, null, 'Umami is disabled')
    }
    if (!project.umamiWebsiteId) {
      return this.envelope('not_configured', null, window, false, null, 'Umami website is not provisioned')
    }

    const cacheKey = this.cacheKey(project.tenantId, project.id, 'timeseries', range)
    const staleKey = `${cacheKey}:stale`
    const cached = this.cacheService.get<unknown>(cacheKey)
    if (cached) {
      return this.envelope('ok', cached, window, false, project.trafficSyncedAt)
    }

    try {
      const series = await this.umamiClient.getPageviews(project.umamiWebsiteId, {
        ...window.epoch,
        unit: 'day',
      })
      this.cacheService.set(cacheKey, series, this.cacheTtlSeconds)
      this.cacheService.set(staleKey, series, this.staleTtlSeconds)
      return this.envelope('ok', series, window, false, new Date())
    } catch (error) {
      return this.degradedFromError(error, staleKey, window, project.trafficSyncedAt)
    }
  }

  /**
   * Soft provision: never throws to callers that ignore return value for fail-soft create.
   */
  async provisionForProject(projectId: string): Promise<{
    status: TrafficStatus
    umamiWebsiteId: string | null
    message?: string
  }> {
    const project = await this.findProjectOrFail(projectId)

    if (!this.umamiClient.isEnabled()) {
      return { status: 'disabled', umamiWebsiteId: project.umamiWebsiteId, message: 'Umami is disabled' }
    }

    if (project.umamiWebsiteId) {
      return { status: 'ok', umamiWebsiteId: project.umamiWebsiteId }
    }

    try {
      const website = await this.umamiClient.createWebsite({
        name: `t${project.tenantId}-${project.slug}`.slice(0, 100),
        domain: project.hostname,
      })
      if (!website.id) {
        return { status: 'degraded', umamiWebsiteId: null, message: 'Umami createWebsite returned empty id' }
      }

      project.umamiWebsiteId = website.id
      project.umamiShareId = website.shareId ?? null
      await this.projectRepository.save(project)
      return { status: 'ok', umamiWebsiteId: website.id }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Umami provision failed'
      this.logger.warn(`Umami provision failed for project ${projectId}: ${message}`)
      return { status: 'degraded', umamiWebsiteId: null, message }
    }
  }

  buildScriptTag(websiteId: string): string {
    const scriptUrl = (this.configService.get<string>('UMAMI_PUBLIC_SCRIPT_URL') ?? '').replace(/\/$/, '')
    const src = scriptUrl
      ? (scriptUrl.endsWith('.js') ? scriptUrl : `${scriptUrl}/script.js`)
      : '/umami/script.js'
    return `<script defer src="${src}" data-website-id="${websiteId}"></script>`
  }

  private async findProjectOrFail(id: string): Promise<SeoProjectEntity> {
    return this.findOneForTenantOrFail(
      this.projectRepository,
      { id },
      'SEO project not found',
    )
  }

  private async markSynced(project: SeoProjectEntity, stats: UmamiStats): Promise<void> {
    project.trafficSyncedAt = new Date()
    project.trafficSnapshot = { ...stats }
    await this.projectRepository.save(project)
  }

  private degradedFromError(
    error: unknown,
    staleKey: string,
    window: ReturnType<AiSeoTrafficService['toRange']>,
    syncedAt: Date | null,
    snapshot?: Record<string, unknown>,
  ): TrafficEnvelope<unknown> {
    const stale = this.cacheService.get<unknown>(staleKey)
      ?? (snapshot && Object.keys(snapshot).length > 0 ? snapshot : null)
    const message = this.errorMessage(error)
    this.logger.warn(`Umami traffic degraded: ${message}`)
    return this.envelope('degraded', stale, window, Boolean(stale), syncedAt, message)
  }

  private errorMessage(error: unknown): string {
    if (error instanceof UmamiAuthError) return 'Umami authentication failed'
    if (error instanceof UmamiNotFoundError) return 'Umami resource not found'
    if (error instanceof UmamiUnavailableError) return error.message
    if (error instanceof Error) return error.message
    return 'Umami unavailable'
  }

  private envelope<T>(
    status: TrafficStatus,
    data: T | null,
    window: ReturnType<AiSeoTrafficService['toRange']> | null,
    stale: boolean,
    syncedAt: Date | string | null,
    message?: string,
  ): TrafficEnvelope<T> {
    return {
      status,
      stale,
      syncedAt: syncedAt instanceof Date ? syncedAt.toISOString() : syncedAt,
      range: window
        ? { start: new Date(window.epoch.startAt).toISOString(), end: new Date(window.epoch.endAt).toISOString() }
        : null,
      data,
      ...(message ? { message } : {}),
    }
  }

  private toRange(range: TrafficRange) {
    const endAt = Date.now()
    const days = range === '30d' ? 30 : 7
    const startAt = endAt - days * 24 * 60 * 60 * 1000
    return { epoch: { startAt, endAt }, label: range }
  }

  private cacheKey(tenantId: number, projectId: string, kind: string, range: string): string {
    return `umami:t${tenantId}:p${projectId}:${kind}:${range}`
  }

  private get cacheTtlSeconds(): number {
    const parsed = Number(this.configService.get<string>('UMAMI_CACHE_TTL_SECONDS') ?? 300)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 300
  }

  private get staleTtlSeconds(): number {
    const parsed = Number(this.configService.get<string>('UMAMI_CACHE_STALE_TTL_SECONDS') ?? 3600)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600
  }
}
