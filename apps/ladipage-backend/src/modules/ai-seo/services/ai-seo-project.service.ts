import { Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common'
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
import { extractHostname, resolveSeoHostname } from '../utils/domain.util'
import { OpenSeoClientService } from './openseo-client.service'

export type EnsureLandingPageOptions = {
  storeId?: string
  /** Prefer public URL / hostname from FE publish when Nest page row is missing */
  publicUrl?: string | null
  hostname?: string | null
  name?: string | null
  slug?: string | null
}

@Injectable()
export class AiSeoProjectService extends TenantScopedService {
  private readonly logger = new Logger(AiSeoProjectService.name)

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
      openseoProjectId = openSeoProject.id?.trim() || null
      if (!openseoProjectId) {
        this.logger.warn(`OpenSEO createProject returned empty id for hostname=${hostname}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`OpenSEO createProject failed for hostname=${hostname}: ${message}`)
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
    let project = await this.findProjectOrFail(id)
    this.quotaService.assertAvailable(tenantId)

    // Self-heal: OpenSEO may have been down at create time
    project = await this.ensureOpenSeoLinked(project)

    if (!project.openseoProjectId) {
      throw new ServiceUnavailableException({
        message:
          'OpenSEO project is not ready. Check OPENSEO_MCP_URL / OpenSEO service, then retry scan.',
        retryAfter: 30,
      })
    }

    const depth = dto.depth ?? ScanDepth.QUICK
    const startUrl = this.toStartUrl(project.hostname)
    let audit: { auditId: string }
    try {
      audit = await this.openSeoClient.startAudit({
        projectId: project.openseoProjectId,
        startUrl,
        maxPages: depth === ScanDepth.FULL ? 50 : 10,
        lighthouseStrategy: 'auto',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Local / non-public hostnames (localhost, *.landing.local) are rejected by OpenSEO (tldts).
      // Keep message actionable; do not rephrase OpenSEO validation away.
      throw new ServiceUnavailableException({
        message: message.startsWith('OpenSEO') ? message : `OpenSEO scan failed: ${message}`,
        retryAfter: 30,
      })
    }

    // Domain-overview fallback completes immediately; real start_audit stays pending.
    // SeoTaskStatus uses approved (not "done") for completed audit work items.
    let immediateResult: Record<string, unknown> = {}
    let taskStatus: 'pending' | 'approved' = 'pending'
    let projectTaskStatus: 'running' | 'done' = 'running'
    let responseStatus: 'running' | 'success' = 'running'

    if (audit.auditId.startsWith('domain-overview-')) {
      try {
        immediateResult = await this.openSeoClient.getAuditResults(
          project.openseoProjectId,
          audit.auditId,
        )
        taskStatus = 'approved'
        projectTaskStatus = 'done'
        responseStatus = 'success'

        const scores = (immediateResult.scores ?? {}) as Record<string, unknown>
        project.holisticScores = {
          ...(project.holisticScores ?? {}),
          technicalsScore: Number(scores.technicalsScore ?? 0) || 0,
          uxScore: Number(scores.uxScore ?? 0) || 0,
          authorityScore: Number(scores.authorityScore ?? 0) || 0,
          contentScore: Number(scores.contentScore ?? 0) || 0,
        }
        project.siteAudit = immediateResult
        project.lastAnalysisAt = new Date()
      } catch {
        // Keep running; jobs poll may still resolve via local cache
      }
    }

    await this.taskRepository.save(
      this.taskRepository.create({
        seoProjectId: project.id,
        externalTaskId: audit.auditId,
        type: 'AUDIT',
        status: taskStatus,
        payload: {
          depth,
          startUrl,
          openseoProjectId: project.openseoProjectId,
          source: audit.auditId.startsWith('domain-overview-')
            ? 'get_domain_overview'
            : 'start_audit',
        },
        result: immediateResult,
      }),
    )

    project.taskStatus = projectTaskStatus
    await this.projectRepository.save(project)

    return { jobId: audit.auditId, status: responseStatus }
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

  async ensureForLandingPage(
    landingPageId: string,
    storeIdOrOptions?: string | EnsureLandingPageOptions,
  ) {
    const options: EnsureLandingPageOptions =
      typeof storeIdOrOptions === 'string'
        ? { storeId: storeIdOrOptions }
        : (storeIdOrOptions ?? {})
    const storeId = options.storeId
    const tenantId = this.requireTenantId()
    const existing = await this.projectRepository.findOne({
      where: { tenantId, landingPageId },
    })
    if (existing) {
      // Upgrade hostname when publish later provides a public domain
      const betterHost = resolveSeoHostname([
        options.hostname,
        options.publicUrl,
        existing.hostname,
      ])
      if (
        betterHost &&
        betterHost !== existing.hostname &&
        extractHostname(existing.hostname) !== betterHost
      ) {
        const localish =
          !existing.hostname.includes('.') ||
          existing.hostname === 'localhost' ||
          existing.hostname.endsWith('.local')
        if (localish || betterHost.includes('.')) {
          existing.hostname = betterHost
          existing.slug = this.slugify(betterHost)
          await this.projectRepository.save(existing)
        }
      }
      if (!existing.umamiWebsiteId) {
        await this.trafficService.provisionForProject(existing.id).catch(() => undefined)
        const refreshed = await this.projectRepository.findOne({ where: { id: existing.id, tenantId } })
        return mapSeoProjectToDto(refreshed ?? existing)
      }
      return mapSeoProjectToDto(existing)
    }

    const page = await this.findPage(landingPageId)
    // Prefer FE publicUrl/hostname so we never store a raw UUID as hostname
    const hostname =
      resolveSeoHostname([
        options.hostname,
        options.publicUrl,
        page?.pageUrl,
        page?.url,
        page?.domain,
        page?.alias,
        options.slug,
        landingPageId,
      ]) || this.normalizeHostname(landingPageId)

    // Reuse manual project with same hostname in tenant (parallel manual + auto flows)
    const byHostname = await this.projectRepository.findOne({
      where: { tenantId, hostname },
      order: { updatedAt: 'DESC' },
    })
    if (byHostname) {
      if (!byHostname.landingPageId) {
        byHostname.landingPageId = landingPageId
        await this.projectRepository.save(byHostname)
      }
      if (!byHostname.umamiWebsiteId) {
        await this.trafficService.provisionForProject(byHostname.id).catch(() => undefined)
      }
      const refreshed = await this.projectRepository.findOne({ where: { id: byHostname.id, tenantId } })
      return mapSeoProjectToDto(refreshed ?? byHostname)
    }

    return this.create({
      hostname,
      name: options.name?.trim() || page?.name || hostname,
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

  /**
   * Link/create remote OpenSEO project when local row has no openseoProjectId.
   * Tenant-scoped; never throws (caller decides hard-fail).
   */
  async ensureOpenSeoLinked(project: SeoProjectEntity): Promise<SeoProjectEntity> {
    if (project.openseoProjectId?.trim()) return project

    try {
      const openSeoProject = await this.openSeoClient.createProject({
        name: project.name,
        domain: project.hostname,
      })
      const remoteId = openSeoProject.id?.trim() || null
      if (!remoteId) {
        this.logger.warn(`ensureOpenSeoLinked: empty remote id for project=${project.id}`)
        return project
      }
      project.openseoProjectId = remoteId
      if (project.status === 'draft') project.status = 'active'
      return await this.projectRepository.save(project)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`ensureOpenSeoLinked failed project=${project.id}: ${message}`)
      return project
    }
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
