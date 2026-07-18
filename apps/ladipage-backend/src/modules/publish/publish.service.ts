import { Inject, Injectable, Logger, NotFoundException, Optional, forwardRef } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import {
  AiSeoPublishService,
  type AfterPublishResult,
  type PreparePublishedHtmlResult,
} from '../ai-seo/services/ai-seo-publish.service'
import { PageEntity } from './entities'

export type CompleteLandingPublishInput = {
  pageId: string
  /** Optional HTML artifact to inject tracking into */
  html?: string | null
  storeId?: string
  /** When true, ensure SEO project even if not previously linked */
  ensureSeoProject?: boolean
  /** Public URL from FE publish (preferred hostname source when Nest page row missing) */
  publicUrl?: string | null
  hostname?: string | null
  name?: string | null
  slug?: string | null
}

export type CompleteLandingPublishResult = {
  pageId: string
  publicUrl: string | null
  html: string | null
  seoProjectId: string | null
  seoSyncStatus: PreparePublishedHtmlResult['seoSyncStatus'] | AfterPublishResult['seoSyncStatus']
  trafficSyncStatus: PreparePublishedHtmlResult['trafficSyncStatus'] | AfterPublishResult['trafficSyncStatus']
  scriptsInjected: { seoPixel: boolean; umami: boolean }
  /** Auto-link created a new project_page row this publish */
  autoLinked: boolean
  published: boolean
  message?: string
}

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name)

  constructor(
    private readonly tenantContext: TenantContextService,
    @Optional()
    @InjectRepository(PageEntity)
    private readonly pageRepository?: Repository<PageEntity>,
    @Optional()
    @Inject(forwardRef(() => AiSeoPublishService))
    private readonly aiSeoPublishService?: AiSeoPublishService,
  ) {}

  async startPublish(funnelId: string, userId: number) {
    return { jobId: 'demo-' + Date.now(), status: 'queued', funnelId, userId }
  }

  /**
   * Legacy hook — ensure SEO project after publish (fail-soft wrapper).
   */
  async onLandingPagePublished(pageId: string, storeId?: string) {
    if (!this.aiSeoPublishService) return null
    return this.aiSeoPublishService.afterPublish(pageId, storeId)
  }

  /**
   * Full L1 publish side-effects for a landing page (tenant-scoped).
   *
   * Auto SEO order (when ensureSeoProject !== false):
   * 1. Ensure + auto-link SEO project + Umami provision (soft)
   * 2. Inject SEO pixel + Umami into HTML (soft)
   * 3. Mark page published (only if page belongs to tenant)
   *
   * Manual flow remains valid: pre-created project is reused by ensure.
   * SEO/Umami errors never block publish flag when page entity exists.
   *
   * Note: FE Supabase pages may not exist in Nest `lp_page` — ensure still
   * creates `lp_seo_project` by landingPageId + hostname/slug options.
   */
  async completeLandingPublish(
    input: CompleteLandingPublishInput,
  ): Promise<CompleteLandingPublishResult> {
    const tenantId = this.requireTenantId()
    const page = await this.findTenantPage(input.pageId)

    let html = input.html ?? null
    let seoProjectId: string | null = null
    let seoSyncStatus: CompleteLandingPublishResult['seoSyncStatus'] = 'skipped'
    let trafficSyncStatus: CompleteLandingPublishResult['trafficSyncStatus'] = 'skipped'
    let scriptsInjected = { seoPixel: false, umami: false }
    let autoLinked = false
    let message: string | undefined

    // --- Auto path first: ensure + link so inject can run on first publish ---
    const shouldEnsure = input.ensureSeoProject !== false
    if (!this.aiSeoPublishService && shouldEnsure) {
      this.logger.warn(
        `completeLandingPublish: AiSeoPublishService missing — cannot auto SEO page=${input.pageId}`,
      )
      seoSyncStatus = 'failed'
      message = 'AI-SEO module not wired'
    }
    if (this.aiSeoPublishService && shouldEnsure) {
      const after = await this.aiSeoPublishService.afterPublish(input.pageId, {
        storeId: input.storeId ?? page?.storeId ?? undefined,
        publicUrl: input.publicUrl ?? page?.pageUrl ?? page?.url ?? null,
        hostname: input.hostname ?? page?.domain ?? null,
        name: input.name ?? page?.name ?? null,
        slug: input.slug ?? page?.alias ?? null,
      })
      if (after.seoProjectId) seoProjectId = after.seoProjectId
      seoSyncStatus = after.seoSyncStatus
      trafficSyncStatus = after.trafficSyncStatus
      autoLinked = after.linked
      if (after.message) message = after.message
      this.logger.log(
        `completeLandingPublish ensure page=${input.pageId} seoProjectId=${seoProjectId} seo=${seoSyncStatus} linked=${autoLinked}`,
      )
    }

    // --- Inject tracking (now that project/link may exist) ---
    if (this.aiSeoPublishService) {
      const prepared = await this.aiSeoPublishService.preparePublishedHtml(input.pageId, html)
      html = prepared.html
      if (prepared.seoProjectId) seoProjectId = prepared.seoProjectId
      if (prepared.seoSyncStatus === 'ok') seoSyncStatus = 'ok'
      if (prepared.seoSyncStatus === 'failed') seoSyncStatus = 'failed'
      if (prepared.trafficSyncStatus !== 'skipped') {
        trafficSyncStatus = prepared.trafficSyncStatus
      }
      scriptsInjected = prepared.scriptsInjected
      if (prepared.message && seoSyncStatus !== 'ok') message = prepared.message
    }

    let published = false
    let publicUrl: string | null = null

    if (page && this.pageRepository) {
      // Isolation: only pages with matching tenantId are loaded above
      page.isPublish = true
      page.publishedAt = new Date()
      await this.pageRepository.save(page)
      published = true
      publicUrl = page.pageUrl || page.url || (page.alias ? `/p/${page.alias}` : null)
    } else if (!this.pageRepository) {
      published = true
      publicUrl = null
    }
    // Missing page row: do not flip isPublish (cannot touch another tenant's page).

    this.logger.log(
      `completeLandingPublish page=${input.pageId} tenant=${tenantId} seo=${seoSyncStatus} traffic=${trafficSyncStatus} linked=${autoLinked}`,
    )

    return {
      pageId: input.pageId,
      publicUrl,
      html,
      seoProjectId,
      seoSyncStatus,
      trafficSyncStatus,
      scriptsInjected,
      autoLinked,
      published,
      ...(message ? { message } : {}),
    }
  }

  /**
   * Unpublish: set offline flag only — does not delete SEO links (isolation-safe soft off).
   */
  async unpublishLandingPage(pageId: string): Promise<{ pageId: string; published: false }> {
    const page = await this.findTenantPage(pageId)
    if (!page || !this.pageRepository) {
      throw new NotFoundException('Landing page not found')
    }
    page.isPublish = false
    await this.pageRepository.save(page)
    return { pageId, published: false }
  }

  private async findTenantPage(pageId: string): Promise<PageEntity | null> {
    if (!this.pageRepository) return null
    const tenantId = this.requireTenantId()
    return this.pageRepository.findOne({
      where: { tenantId, externalId: pageId, isDelete: false },
    })
  }

  private requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) {
      throw new NotFoundException('Landing page not found')
    }
    return tenantId
  }
}
