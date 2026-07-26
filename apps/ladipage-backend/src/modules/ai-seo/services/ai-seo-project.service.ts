import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { PageEntity } from '../../publish/entities'
import { CreateSeoProjectDto } from '../dto/create-seo-project.dto'
import { ListSeoProjectsQueryDto } from '../dto/list-seo-projects-query.dto'
import { ScanDepth, ScanProjectDto } from '../dto/scan-project.dto'
import { UpdateSeoProjectDto } from '../dto/update-seo-project.dto'
import { SeoProjectEntity, SeoProjectPageEntity, SeoTaskEntity } from '../entities'
import type { SeoTaskType } from '../entities/seo-task.entity'
import { mapSeoProjectToDto } from '../mappers/seo-project.mapper'
import { auditHtml, scoresFromPageIssues, type PageAuditIssue } from '../utils/page-audit.util'
import { extractHostname, resolveSeoHostname } from '../utils/domain.util'
import { resolveScanStartUrl, scanBlockedMessage } from '../utils/scan-url.util'
import { AiSeoQuotaService } from './ai-seo-quota.service'
import { AiSeoTrafficService } from './ai-seo-traffic.service'
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
    @InjectRepository(SeoProjectPageEntity)
    private readonly projectPageRepository: Repository<SeoProjectPageEntity>,
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

    const linkedPages = await this.projectPageRepository.find({
      where: { seoProjectId: project.id, tenantId },
      order: { updatedAt: 'DESC' },
    })
    const pageUrlCandidates = linkedPages.map((p) => p.pageUrl)
    if (project.landingPageId) {
      const builder = await this.findPage(project.landingPageId)
      if (builder) {
        pageUrlCandidates.unshift(builder.pageUrl, builder.url, builder.domain, builder.alias)
      }
    }

    const resolved = resolveScanStartUrl([
      ...pageUrlCandidates,
      project.hostname,
      this.toStartUrl(project.hostname),
    ])

    if (!resolved.startUrl || (!resolved.canDomainOverview && !resolved.canPageAudit)) {
      throw new BadRequestException(scanBlockedMessage(resolved.host || project.hostname))
    }

    const depth = dto.depth ?? ScanDepth.QUICK
    const startUrl = resolved.startUrl
    const modes: string[] = []
    let auditId = `hybrid-${Date.now()}`
    let domainResult: Record<string, unknown> = {}
    let pageIssues: PageAuditIssue[] = []
    let holistic = {
      technicalsScore: 0,
      uxScore: 0,
      authorityScore: 0,
      contentScore: 0,
    }

    // Path A — domain overview (public registrable only)
    if (resolved.canDomainOverview) {
      project = await this.ensureOpenSeoLinked(project)
      if (!project.openseoProjectId) {
        throw new ServiceUnavailableException({
          message:
            'OpenSEO project is not ready. Check OPENSEO_MCP_URL / OpenSEO service, then retry scan.',
          retryAfter: 30,
        })
      }
      try {
        const audit = await this.openSeoClient.startAudit({
          projectId: project.openseoProjectId,
          startUrl,
          maxPages: depth === ScanDepth.FULL ? 50 : 10,
          lighthouseStrategy: 'auto',
        })
        auditId = audit.auditId
        if (audit.auditId.startsWith('domain-overview-')) {
          domainResult =
            (await this.openSeoClient.getAuditResults(project.openseoProjectId, audit.auditId)) ??
            {}
          modes.push('domain_overview')
          const scores = (domainResult.scores ?? {}) as Record<string, unknown>
          holistic = {
            technicalsScore: Number(scores.technicalsScore ?? 0) || 0,
            uxScore: Number(scores.uxScore ?? 0) || 0,
            authorityScore: Number(scores.authorityScore ?? 0) || 0,
            contentScore: Number(scores.contentScore ?? 0) || 0,
          }
          // Soft enrichment (fail-soft)
          const [backlinks, kwSuggest] = await Promise.all([
            this.openSeoClient.getBacklinksOverviewSafe(project.openseoProjectId, resolved.host),
            this.openSeoClient.getDomainKeywordSuggestionsSafe(
              project.openseoProjectId,
              resolved.host,
            ),
          ])
          if (backlinks) domainResult = { ...domainResult, backlinks }
          if (kwSuggest) domainResult = { ...domainResult, keywordSuggestions: kwSuggest }
        } else {
          modes.push('start_audit')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!resolved.canPageAudit) {
          throw new ServiceUnavailableException({
            message: message.startsWith('OpenSEO') ? message : `OpenSEO scan failed: ${message}`,
            retryAfter: 30,
          })
        }
        this.logger.warn(`Path A soft-fail project=${project.id}: ${message}`)
      }
    }

    // Path B-lite — page HTML rules (any crawlable absolute URL)
    if (resolved.canPageAudit) {
      try {
        const html = await this.fetchPageHtml(startUrl)
        pageIssues = auditHtml(html ?? '', startUrl)
        const pageScores = scoresFromPageIssues(pageIssues)
        // Prefer page scores when we audited HTML; blend authority from domain path
        holistic = {
          technicalsScore: pageScores.technicalsScore,
          contentScore: pageScores.contentScore,
          uxScore: pageScores.uxScore,
          authorityScore:
            holistic.authorityScore > 0 ? holistic.authorityScore : pageScores.authorityScore,
        }
        modes.push('page_audit')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`Path B-lite soft-fail project=${project.id}: ${message}`)
        if (modes.length === 0) {
          throw new ServiceUnavailableException({
            message: `Page audit failed: ${message}`,
            retryAfter: 30,
          })
        }
      }
    }

    if (modes.length === 0) {
      throw new BadRequestException(scanBlockedMessage(resolved.host || project.hostname))
    }

    const immediateResult: Record<string, unknown> = {
      source: modes.join('+'),
      startUrl,
      host: resolved.host,
      domain: domainResult,
      pageIssues,
      scores: holistic,
      mode: modes.includes('domain_overview') && modes.includes('page_audit')
        ? 'hybrid'
        : modes[0],
    }

    const taskStatus: 'pending' | 'approved' =
      modes.includes('start_audit') && !modes.includes('domain_overview') ? 'pending' : 'approved'
    const projectTaskStatus: 'running' | 'done' = taskStatus === 'pending' ? 'running' : 'done'
    const responseStatus: 'running' | 'success' = taskStatus === 'pending' ? 'running' : 'success'

    await this.taskRepository.save(
      this.taskRepository.create({
        seoProjectId: project.id,
        externalTaskId: auditId,
        type: 'AUDIT',
        status: taskStatus,
        payload: {
          depth,
          startUrl,
          openseoProjectId: project.openseoProjectId,
          modes,
        },
        result: immediateResult,
      }),
    )

    if (projectTaskStatus === 'done') {
      project.holisticScores = {
        ...(project.holisticScores ?? {}),
        ...holistic,
      }
      project.siteAudit = immediateResult
      project.lastAnalysisAt = new Date()
      project.taskStatus = 'done'
      await this.projectRepository.save(project)
      await this.syncLinkedPagesAfterScan(project, auditId, holistic)
      await this.upsertIssuesAsTasks(project.id, pageIssues, linkedPages[0]?.websitePageId ?? project.landingPageId)
    } else {
      project.taskStatus = 'running'
      await this.projectRepository.save(project)
    }

    return {
      jobId: auditId,
      status: responseStatus,
      mode: immediateResult.mode,
      startUrl,
    }
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
    // Same hybrid scan; page list scores sync covers linked rows including pageId.
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

  private async fetchPageHtml(url: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Liora-AiSeo-PageAudit/1.0',
        },
      })
      if (!res.ok) return null
      const text = await res.text()
      // Cap size for rule engine
      return text.slice(0, 500_000)
    } catch (err) {
      this.logger.warn(`fetchPageHtml failed for ${url}: ${err instanceof Error ? err.message : String(err)}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  private async syncLinkedPagesAfterScan(
    project: SeoProjectEntity,
    jobId: string,
    scores: {
      technicalsScore: number
      contentScore: number
      uxScore: number
      authorityScore: number
    },
  ): Promise<void> {
    const tenantId = this.requireTenantId()
    const pages = await this.projectPageRepository.find({
      where: { seoProjectId: project.id, tenantId },
    })
    if (pages.length === 0) return

    const grader = Math.round(
      (scores.technicalsScore + scores.contentScore + scores.uxScore + scores.authorityScore) / 4,
    )
    const now = new Date()
    for (const page of pages) {
      page.scanStatus = 'completed'
      page.lastScanJobId = jobId
      page.lastScannedAt = now

      const existingScores = page.scores ?? {}
      const hasPageLevelScores =
        existingScores.contentScore !== undefined ||
        existingScores.technicalScore !== undefined ||
        existingScores.lighthouse !== undefined

      page.scores = {
        ...existingScores,
        // Only set domain fallback scores if page doesn't have its own page-level scores
        graderScore: hasPageLevelScores ? (existingScores.graderScore ?? grader) : grader,
        contentScore: hasPageLevelScores ? (existingScores.contentScore ?? scores.contentScore) : scores.contentScore,
        technicalScore: hasPageLevelScores ? (existingScores.technicalScore ?? scores.technicalsScore) : scores.technicalsScore,
        uxScore: hasPageLevelScores ? (existingScores.uxScore ?? scores.uxScore) : scores.uxScore,
        authorityScore: scores.authorityScore,
      }
    }
    await this.projectPageRepository.save(pages)
  }

  /** Dedup issue tasks by code within recent window; create ON_PAGE/CONTENT/TECHNICAL rows. */
  private async upsertIssuesAsTasks(
    projectId: string,
    issues: PageAuditIssue[],
    websitePageId: string | null | undefined,
  ): Promise<void> {
    if (!issues.length) return

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const existing = await this.taskRepository
      .createQueryBuilder('task')
      .where('task.seoProjectId = :projectId', { projectId })
      .andWhere('task.type IN (:...types)', { types: ['ON_PAGE', 'CONTENT', 'TECHNICAL'] })
      .andWhere('task.createdAt >= :since', { since })
      .getMany()

    const existingCodes = new Set(
      existing.map((t) => String((t.payload ?? {}).code ?? '')).filter(Boolean),
    )

    const toCreate = issues.filter((i) => !existingCodes.has(i.code))
    if (!toCreate.length) return

    await this.taskRepository.save(
      toCreate.map((issue) =>
        this.taskRepository.create({
          seoProjectId: projectId,
          externalTaskId: null,
          type: issue.type as SeoTaskType,
          status: 'pending',
          payload: {
            code: issue.code,
            severity: issue.severity,
            message: issue.message,
            current: issue.current,
            suggested: issue.suggested,
            websitePageId: websitePageId ?? null,
          },
          result: {
            metaTitle: issue.metaTitle ?? null,
            metaDescription: issue.metaDescription ?? null,
            feStatus: 'todo',
          },
        }),
      ),
    )
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 'true'
  }
}
