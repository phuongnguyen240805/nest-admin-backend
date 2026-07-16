import { Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { PageEntity } from '../../publish/entities'
import { CreateSeoProjectDto } from '../dto/create-seo-project.dto'
import { ListSeoProjectsQueryDto } from '../dto/list-seo-projects-query.dto'
import { ScanDepth, ScanProjectDto } from '../dto/scan-project.dto'
import { UpdateSeoProjectDto } from '../dto/update-seo-project.dto'
import { SeoProjectEntity, SeoTaskEntity } from '../entities'
import { mapSeoProjectToDto } from '../mappers/seo-project.mapper'
import { AiSeoQuotaService } from './ai-seo-quota.service'
import { AiSeoTrafficService } from './ai-seo-traffic.service'
import { OpenSeoClientService } from './openseo-client.service'

@Injectable()
export class AiSeoProjectService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    @InjectRepository(SeoTaskEntity)
    private readonly taskRepository: Repository<SeoTaskEntity>,
    @Optional()
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity> | undefined,
    private readonly openSeoClient: OpenSeoClientService,
    private readonly quotaService: AiSeoQuotaService,
    private readonly trafficService: AiSeoTrafficService,
  ) {
    super(tenantContext)
  }

  async list(dto: ListSeoProjectsQueryDto, storeId?: string) {
    const tenantId = this.requireTenantId()
    const query = this.projectRepository
      .createQueryBuilder('project')
      .where('project.tenantId = :tenantId', { tenantId })
      .andWhere('project.status != :archived', { archived: 'archived' })

    if (storeId) {
      query.andWhere('project.storeId = :storeId', { storeId })
    }

    if (this.toBoolean(dto.favorite)) {
      query.andWhere('project.isFavorite = true')
    }

    if (dto.search) {
      query.andWhere('(project.name ILIKE :search OR project.hostname ILIKE :search)', {
        search: `%${dto.search}%`,
      })
    }

    const page = this.positiveNumber(dto.page, 1)
    const pageSize = this.positiveNumber(dto.pageSize, 50)
    const projects = await query
      .orderBy('project.updatedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany()

    return projects.map(mapSeoProjectToDto)
  }

  async create(dto: CreateSeoProjectDto, storeId?: string) {
    const tenantId = this.requireTenantId()
    const hostname = this.normalizeHostname(dto.hostname)
    const name = dto.name?.trim() || hostname
    const slug = this.slugify(hostname)
    let openseoProjectId: string | null = null

    try {
      const openSeoProject = await this.openSeoClient.createProject({ name, domain: hostname })
      openseoProjectId = openSeoProject.id || null
    } catch {
      openseoProjectId = null
    }

    const project = await this.projectRepository.save(
      this.projectRepository.create({
        tenantId,
        storeId: storeId ?? null,
        landingPageId: dto.landingPageId ?? null,
        name,
        hostname,
        slug,
        status: openseoProjectId ? 'active' : 'draft',
        openseoProjectId,
        taskStatus: 'pending',
        pixelTagState: 'not_installed',
        isFavorite: false,
        holisticScores: {},
        connectedData: {},
        siteAudit: {},
        lastAnalysisAt: null,
        umamiWebsiteId: null,
        umamiShareId: null,
        trafficScriptState: 'not_installed',
        trafficSyncedAt: null,
        trafficSnapshot: {},
      }),
    )

    // Fail-soft Umami provision — never blocks SEO project create
    await this.trafficService.provisionForProject(project.id).catch(() => undefined)
    const refreshed = await this.projectRepository.findOne({ where: { id: project.id, tenantId } })
    return mapSeoProjectToDto(refreshed ?? project)
  }

  async detail(id: string) {
    return mapSeoProjectToDto(await this.findProjectOrFail(id))
  }

  async setup(id: string, body?: Record<string, unknown>) {
    const project = await this.findProjectOrFail(id)
    if (body && Object.keys(body).length > 0) {
      project.siteAudit = {
        ...(project.siteAudit ?? {}),
        businessProfile: body,
      }
      await this.projectRepository.save(project)
    }
    return mapSeoProjectToDto(project)
  }

  async update(id: string, dto: UpdateSeoProjectDto) {
    const project = await this.findProjectOrFail(id)

    if (dto.hostname) {
      project.hostname = this.normalizeHostname(dto.hostname)
      project.slug = this.slugify(project.hostname)
    }

    if (dto.name) project.name = dto.name
    if (dto.landingPageId !== undefined) project.landingPageId = dto.landingPageId
    if (dto.status) project.status = dto.status
    if (dto.isFavorite !== undefined) project.isFavorite = dto.isFavorite

    return mapSeoProjectToDto(await this.projectRepository.save(project))
  }

  async remove(id: string): Promise<void> {
    const project = await this.findProjectOrFail(id)
    project.status = 'archived'
    await this.projectRepository.save(project)
  }

  async setFavorite(id: string, favorite: boolean) {
    const project = await this.findProjectOrFail(id)
    project.isFavorite = favorite
    return mapSeoProjectToDto(await this.projectRepository.save(project))
  }

  async toggleFavorite(id: string) {
    const project = await this.findProjectOrFail(id)
    project.isFavorite = !project.isFavorite
    const saved = await this.projectRepository.save(project)
    return {
      id: saved.id,
      projectId: saved.id,
      isFavorite: saved.isFavorite,
    }
  }

  async toggleAgentStatus(id: string) {
    const project = await this.findProjectOrFail(id)
    project.isEngaged = !project.isEngaged
    const saved = await this.projectRepository.save(project)
    return {
      id: saved.id,
      projectId: saved.id,
      isEngaged: saved.isEngaged,
    }
  }

  async scan(id: string, dto: ScanProjectDto) {
    const tenantId = this.requireTenantId()
    const project = await this.findProjectOrFail(id)
    this.quotaService.assertAvailable(tenantId)

    if (!project.openseoProjectId) {
      throw new ServiceUnavailableException({
        message: 'OpenSEO project is not ready. Retry after project setup is complete.',
        retryAfter: 30,
      })
    }

    const depth = dto.depth ?? ScanDepth.QUICK
    const audit = await this.openSeoClient.startAudit({
      projectId: project.openseoProjectId,
      startUrl: this.toStartUrl(project.hostname),
      maxPages: depth === ScanDepth.FULL ? 50 : 10,
      lighthouseStrategy: 'auto',
    })

    await this.taskRepository.save(
      this.taskRepository.create({
        seoProjectId: project.id,
        externalTaskId: audit.auditId,
        type: 'AUDIT',
        status: 'pending',
        payload: {
          depth,
          startUrl: this.toStartUrl(project.hostname),
          openseoProjectId: project.openseoProjectId,
        },
        result: {},
      }),
    )

    project.taskStatus = 'running'
    await this.projectRepository.save(project)

    return { jobId: audit.auditId, status: 'running' }
  }

  async agentStatus(id: string) {
    const project = await this.findProjectOrFail(id)
    return {
      projectId: project.id,
      openseoProjectId: project.openseoProjectId,
      status: project.taskStatus,
      ready: Boolean(project.openseoProjectId),
      lastAnalysisAt: project.lastAnalysisAt?.toISOString() ?? null,
    }
  }

  async listLandingPages(projectId: string) {
    const project = await this.findProjectOrFail(projectId)
    if (!project.landingPageId) return []
    const page = await this.findPage(project.landingPageId)
    return page ? [this.mapLandingPage(page)] : []
  }

  async landingPageDetail(projectId: string, pageId: string) {
    await this.findProjectOrFail(projectId)
    const page = await this.findPage(pageId)
    if (!page) throw new NotFoundException('Landing page not found')
    return this.mapLandingPage(page)
  }

  async scanLandingPage(projectId: string, pageId: string, dto: ScanProjectDto) {
    await this.landingPageDetail(projectId, pageId)
    return this.scan(projectId, dto)
  }

  async landingPageScores(projectId: string, pageId: string) {
    await this.landingPageDetail(projectId, pageId)
    const project = await this.findProjectOrFail(projectId)
    return {
      projectId,
      pageId,
      holisticScores: mapSeoProjectToDto(project).holisticScores,
      siteAudit: project.siteAudit ?? {},
    }
  }

  async ensureForLandingPage(landingPageId: string, storeId?: string) {
    const tenantId = this.requireTenantId()
    const existing = await this.projectRepository.findOne({
      where: { tenantId, landingPageId },
    })
    if (existing) {
      if (!existing.umamiWebsiteId) {
        await this.trafficService.provisionForProject(existing.id).catch(() => undefined)
        const refreshed = await this.projectRepository.findOne({ where: { id: existing.id, tenantId } })
        return mapSeoProjectToDto(refreshed ?? existing)
      }
      return mapSeoProjectToDto(existing)
    }

    const page = await this.findPage(landingPageId)
    const hostname = page
      ? this.normalizeHostname(page.pageUrl || page.url || page.domain || page.alias || page.externalId)
      : landingPageId

    return this.create({
      hostname,
      name: page?.name ?? hostname,
      landingPageId,
    }, storeId)
  }

  async installation(id: string) {
    const project = await this.findProjectOrFail(id)
    return {
      projectId: project.id,
      pixelTagState: project.pixelTagState,
      script: `<script data-liora-ai-seo-project="${project.id}"></script>`,
    }
  }

  async checkInstallation(id: string) {
    const project = await this.findProjectOrFail(id)
    return {
      projectId: project.id,
      installed: project.pixelTagState === 'installed',
      pixelTagState: project.pixelTagState,
    }
  }

  async findProjectOrFail(id: string): Promise<SeoProjectEntity> {
    return this.findOneForTenantOrFail(
      this.projectRepository,
      { id },
      'SEO project not found',
    )
  }

  private async findPage(pageId: string): Promise<PageEntity | null> {
    if (!this.pageRepository) return null
    return this.pageRepository.findOne({
      where: {
        tenantId: this.requireTenantId(),
        externalId: pageId,
      },
    })
  }

  private mapLandingPage(page: PageEntity) {
    return {
      id: page.externalId,
      uuid: page.externalId,
      name: page.name,
      slug: page.alias,
      hostname: page.pageUrl || page.url || page.domain || page.alias,
      status: page.isPublish ? 'published' : 'draft',
      publishedAt: page.isPublish ? page.updatedAt.toISOString() : null,
      updatedAt: page.updatedAt.toISOString(),
    }
  }

  private normalizeHostname(value: string): string {
    return value
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .toLowerCase()
  }

  private slugify(value: string): string {
    const slug = value
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '')

    return slug || 'seo-project'
  }

  private toStartUrl(hostname: string): string {
    return /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 'true'
  }
}
