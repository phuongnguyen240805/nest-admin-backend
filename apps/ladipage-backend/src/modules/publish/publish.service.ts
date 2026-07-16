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
}

export type CompleteLandingPublishResult = {
  pageId: string
  publicUrl: string | null
  html: string | null
  seoProjectId: string | null
  seoSyncStatus: PreparePublishedHtmlResult['seoSyncStatus'] | AfterPublishResult['seoSyncStatus']
  trafficSyncStatus: PreparePublishedHtmlResult['trafficSyncStatus'] | AfterPublishResult['trafficSyncStatus']
  scriptsInjected: { seoPixel: boolean; umami: boolean }
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
   * Full L1 publish side-effects for a landing page (tenant-scoped):
   * 1. Assert page ownership (when PageEntity present)
   * 2. Inject SEO pixel + Umami into HTML when linked (soft)
   * 3. Mark page published (soft if no page row)
   * 4. Ensure SEO project + Umami provision when ensureSeoProject (soft)
   *
   * SEO/Umami errors never block marking publish when page entity exists.
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
    let message: string | undefined

    if (this.aiSeoPublishService) {
      const prepared = await this.aiSeoPublishService.preparePublishedHtml(input.pageId, html)
      html = prepared.html
      seoProjectId = prepared.seoProjectId
      seoSyncStatus = prepared.seoSyncStatus
      trafficSyncStatus = prepared.trafficSyncStatus
      scriptsInjected = prepared.scriptsInjected
      message = prepared.message
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
      // No page store — HTML/SEO-only path
      published = true
      publicUrl = null
    }
    // Missing page row: do not flip isPublish (cannot touch another tenant's page);
    // still allow soft SEO ensure for external landing ids.

    const shouldEnsure = input.ensureSeoProject !== false
    if (this.aiSeoPublishService && shouldEnsure) {
      const after = await this.aiSeoPublishService.afterPublish(input.pageId, input.storeId)
      if (after.seoProjectId) seoProjectId = after.seoProjectId
      if (after.seoSyncStatus === 'failed') seoSyncStatus = 'failed'
      else if (seoSyncStatus === 'skipped' && after.seoSyncStatus === 'ok') seoSyncStatus = 'ok'
      if (after.trafficSyncStatus !== 'skipped') trafficSyncStatus = after.trafficSyncStatus
      if (after.message) message = after.message

      // Re-inject if ensure just created umami website and we still have html
      if (html && after.seoProjectId && after.trafficSyncStatus === 'ok') {
        const again = await this.aiSeoPublishService.preparePublishedHtml(input.pageId, html)
        html = again.html
        scriptsInjected = {
          seoPixel: scriptsInjected.seoPixel || again.scriptsInjected.seoPixel,
          umami: scriptsInjected.umami || again.scriptsInjected.umami,
        }
      }
    }

    this.logger.log(
      `completeLandingPublish page=${input.pageId} tenant=${tenantId} seo=${seoSyncStatus} traffic=${trafficSyncStatus}`,
    )

    return {
      pageId: input.pageId,
      publicUrl,
      html,
      seoProjectId,
      seoSyncStatus,
      trafficSyncStatus,
      scriptsInjected,
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
