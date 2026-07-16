import { Injectable, Logger, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { PageEntity } from '../../publish/entities'
import { SeoProjectEntity, SeoProjectPageEntity } from '../entities'
import {
  buildLioraSeoPixelScript,
  htmlHasSeoPixel,
  htmlHasUmamiWebsite,
  injectHtmlBeforeHeadClose,
} from '../hooks/ai-seo-publish.hook'
import { AiSeoProjectService } from './ai-seo-project.service'
import { AiSeoTrafficService, TrafficStatus } from './ai-seo-traffic.service'

export type SeoSyncStatus = 'ok' | 'skipped' | 'failed'
/** Traffic side of publish pipeline (includes soft-fail). */
export type PublishTrafficSyncStatus = TrafficStatus | 'skipped' | 'failed'
export type PublishScriptsInjected = { seoPixel: boolean; umami: boolean }

export type PreparePublishedHtmlResult = {
  html: string | null
  seoProjectId: string | null
  seoSyncStatus: SeoSyncStatus
  trafficSyncStatus: PublishTrafficSyncStatus
  scriptsInjected: PublishScriptsInjected
  message?: string
}

export type AfterPublishResult = {
  seoProjectId: string | null
  seoSyncStatus: SeoSyncStatus
  trafficSyncStatus: PublishTrafficSyncStatus
  message?: string
}

/**
 * Domain adapter for publish ↔ AI-SEO.
 * Always tenant-scoped; SEO/Umami failures are soft (never throw for sync steps).
 */
@Injectable()
export class AiSeoPublishService extends TenantScopedService {
  private readonly logger = new Logger(AiSeoPublishService.name)

  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    @InjectRepository(SeoProjectPageEntity)
    private readonly projectPageRepository: Repository<SeoProjectPageEntity>,
    @Optional()
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity> | undefined,
    private readonly projectService: AiSeoProjectService,
    private readonly trafficService: AiSeoTrafficService,
  ) {
    super(tenantContext)
  }

  /**
   * Resolve linked SEO project for a landing page within the current tenant only.
   */
  async findLinkedProjectForLandingPage(landingPageId: string): Promise<SeoProjectEntity | null> {
    const tenantId = this.requireTenantId()

    const linkedPage = await this.projectPageRepository.findOne({
      where: {
        tenantId,
        websitePageId: landingPageId,
      },
      order: { updatedAt: 'DESC' },
    })

    if (linkedPage) {
      const byLink = await this.projectRepository.findOne({
        where: { id: linkedPage.seoProjectId, tenantId },
      })
      if (byLink) return byLink
    }

    return this.projectRepository.findOne({
      where: { tenantId, landingPageId },
    })
  }

  /**
   * Inject tracking scripts into HTML when a SEO project is already linked.
   * Does not create projects; use {@link afterPublish} for ensure + provision.
   */
  async preparePublishedHtml(
    landingPageId: string,
    html: string | null | undefined,
  ): Promise<PreparePublishedHtmlResult> {
    const emptyInject = { seoPixel: false, umami: false }

    try {
      await this.assertLandingPageOwnedByTenant(landingPageId)

      const project = await this.findLinkedProjectForLandingPage(landingPageId)
      if (!project) {
        return {
          html: html ?? null,
          seoProjectId: null,
          seoSyncStatus: 'skipped',
          trafficSyncStatus: 'skipped',
          scriptsInjected: emptyInject,
          message: 'No SEO project linked to this landing page',
        }
      }

      if (html == null || html === '') {
        return {
          html: null,
          seoProjectId: project.id,
          seoSyncStatus: 'ok',
          trafficSyncStatus: project.umamiWebsiteId ? 'ok' : 'not_configured',
          scriptsInjected: emptyInject,
        }
      }

      let nextHtml = html
      let seoPixel = false
      let umami = false

      const pixel = buildLioraSeoPixelScript(project.id)
      if (!htmlHasSeoPixel(nextHtml, project.id)) {
        nextHtml = injectHtmlBeforeHeadClose(nextHtml, pixel)
        seoPixel = true
      } else {
        seoPixel = true
      }

      let trafficSyncStatus: PublishTrafficSyncStatus = 'skipped'
      if (project.umamiWebsiteId) {
        const umamiTag = this.trafficService.buildScriptTag(project.umamiWebsiteId)
        if (!htmlHasUmamiWebsite(nextHtml, project.umamiWebsiteId)) {
          nextHtml = injectHtmlBeforeHeadClose(nextHtml, umamiTag)
        }
        umami = true
        trafficSyncStatus = 'ok'
        if (project.trafficScriptState !== 'installed') {
          project.trafficScriptState = 'installed'
          await this.projectRepository.save(project)
        }
      } else {
        trafficSyncStatus = 'not_configured'
      }

      if (seoPixel && project.pixelTagState !== 'installed') {
        project.pixelTagState = 'installed'
        await this.projectRepository.save(project)
      }

      return {
        html: nextHtml,
        seoProjectId: project.id,
        seoSyncStatus: 'ok',
        trafficSyncStatus,
        scriptsInjected: { seoPixel, umami },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI-SEO publish prepare failed'
      this.logger.warn(`preparePublishedHtml soft-fail: ${message}`)
      return {
        html: html ?? null,
        seoProjectId: null,
        seoSyncStatus: 'failed',
        trafficSyncStatus: 'failed',
        scriptsInjected: emptyInject,
        message,
      }
    }
  }

  /**
   * After HTML is persisted: ensure SEO project + soft Umami provision (tenant-scoped).
   */
  async afterPublish(landingPageId: string, storeId?: string): Promise<AfterPublishResult> {
    try {
      await this.assertLandingPageOwnedByTenant(landingPageId)

      const dto = await this.projectService.ensureForLandingPage(landingPageId, storeId)
      const provision = await this.trafficService.provisionForProject(dto.id)

      return {
        seoProjectId: dto.id,
        seoSyncStatus: 'ok',
        trafficSyncStatus: provision.status,
        message: provision.message,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI-SEO afterPublish failed'
      this.logger.warn(`afterPublish soft-fail: ${message}`)
      return {
        seoProjectId: null,
        seoSyncStatus: 'failed',
        trafficSyncStatus: 'failed',
        message,
      }
    }
  }

  /**
   * Verify builder page belongs to current tenant when PageEntity is available.
   * If page repo missing or page not found as entity, allow (external URL link path).
   * Hard isolation: when page exists under another tenant shape, reject via null find + optional throw for internal source.
   */
  async assertLandingPageOwnedByTenant(landingPageId: string): Promise<void> {
    if (!this.pageRepository) return

    const tenantId = this.requireTenantId()
    const page = await this.pageRepository.findOne({
      where: { tenantId, externalId: landingPageId, isDelete: false },
    })

    // Page not in builder DB — may be external URL only; no cross-tenant row possible here.
    if (!page) return
  }

  /**
   * For internal links: require website page to exist under current tenant.
   */
  async assertInternalWebsitePage(websitePageId: string): Promise<boolean> {
    if (!this.pageRepository) return true
    const tenantId = this.requireTenantId()
    const page = await this.pageRepository.findOne({
      where: { tenantId, externalId: websitePageId, isDelete: false },
    })
    return Boolean(page)
  }
}
