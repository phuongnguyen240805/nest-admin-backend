import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { PageEntity } from '../../publish/entities'
import { LinkLandingPageDto } from '../dto/link-landing-page.dto'
import { AiSeoLandingPageService } from './ai-seo-landing-page.service'
import { AiSeoProjectService } from './ai-seo-project.service'

@Injectable()
export class AiSeoWebsiteService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @Optional()
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity> | undefined,
    private readonly projectService: AiSeoProjectService,
    private readonly landingPageService: AiSeoLandingPageService,
  ) {
    super(tenantContext)
  }

  listWebsiteProjects() {
    const tenantId = this.requireTenantId()
    const virtualId = this.virtualProjectId(tenantId)
    const now = new Date().toISOString()

    return [{
      id: virtualId,
      organization_id: String(tenantId),
      project_id: 'default-project',
      name: 'Landing Page Builder (Hệ thống)',
      domain: 'builder-pages.local',
      status: 'active',
      created_at: now,
      updated_at: now,
    }]
  }

  async listWebsitePages(websiteProjectId: string) {
    const tenantId = this.requireTenantId()
    if (websiteProjectId !== this.virtualProjectId(tenantId)) {
      return []
    }

    if (!this.pageRepository) return []

    const pages = await this.pageRepository.find({
      where: { tenantId, isDelete: false },
      order: { updatedAt: 'DESC' },
      take: 100,
    })

    return pages.map((page) => this.mapWebsitePage(page, tenantId))
  }

  async publishWebsitePage(websiteProjectId: string, pageId: string) {
    const page = await this.findBuilderPage(websiteProjectId, pageId)
    if (page) {
      page.isPublish = true
      await this.pageRepository!.save(page)
    }

    const seoProject = await this.projectService.ensureForLandingPage(pageId)
    return this.mapWebsitePage(page ?? null, this.requireTenantId(), pageId, 'published')
  }

  async connectWebsitePageToAiSeo(
    websiteProjectId: string,
    pageId: string,
    aiSeoProjectId: string,
  ) {
    const page = await this.findBuilderPage(websiteProjectId, pageId)
    const pageUrl = page
      ? (page.pageUrl || page.url || `https://${page.domain ?? page.alias}`)
      : `https://page.local/${pageId}`

    const linkDto: LinkLandingPageDto = {
      pageUrl,
      websitePageId: pageId,
      source: 'internal',
    }

    return this.landingPageService.link(aiSeoProjectId, linkDto)
  }

  private async findBuilderPage(websiteProjectId: string, pageId: string) {
    const tenantId = this.requireTenantId()
    if (websiteProjectId !== this.virtualProjectId(tenantId) || !this.pageRepository) {
      return null
    }

    return this.pageRepository.findOne({
      where: { tenantId, externalId: pageId, isDelete: false },
    })
  }

  private mapWebsitePage(
    page: PageEntity | null,
    tenantId: number,
    fallbackId?: string,
    forcedStatus?: 'draft' | 'published',
  ) {
    const id = page?.externalId ?? fallbackId ?? 'unknown'
    const slug = page?.alias ?? id
    const status = forcedStatus ?? (page?.isPublish ? 'published' : 'draft')
    const now = new Date().toISOString()

    return {
      id,
      organization_id: String(tenantId),
      website_project_id: this.virtualProjectId(tenantId),
      project_id: 'default-project',
      title: page?.name ?? 'Untitled Page',
      slug,
      page_url: page?.pageUrl || page?.url || `/p/${slug}`,
      page_type: 'landing_page',
      status,
      published_url: status === 'published' ? (page?.pageUrl || page?.url || `/p/${slug}`) : null,
      seo_title: page?.name ?? 'Untitled Page',
      seo_description: '',
      created_at: page?.createdAt?.toISOString() ?? now,
      updated_at: page?.updatedAt?.toISOString() ?? now,
    }
  }

  private virtualProjectId(tenantId: number): string {
    return `builder-${tenantId}`
  }
}