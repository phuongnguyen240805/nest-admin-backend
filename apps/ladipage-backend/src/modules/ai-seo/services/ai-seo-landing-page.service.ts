import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { In, Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { PageEntity } from '../../publish/entities'
import { LinkLandingPageDto } from '../dto/link-landing-page.dto'
import { ScanProjectDto } from '../dto/scan-project.dto'
import { SeoProjectEntity, SeoProjectPageEntity } from '../entities'
import {
  mapLandingPageScores,
  mapLandingPageTask,
  mapSeoProjectPageToDto,
} from '../mappers/seo-project-page.mapper'
import { AiSeoProjectService } from './ai-seo-project.service'
import { AiSeoTaskService } from './ai-seo-task.service'
import { LabScanService } from './lab-scan.service'

@Injectable()
export class AiSeoLandingPageService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoProjectPageEntity)
    private readonly pageRepository: Repository<SeoProjectPageEntity>,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    @Optional()
    @InjectRepository(PageEntity)
    private readonly builderPageRepository: Repository<PageEntity> | undefined,
    private readonly projectService: AiSeoProjectService,
    private readonly taskService: AiSeoTaskService,
    private readonly labScanService: LabScanService,
  ) {
    super(tenantContext)
  }

  async list(projectId: string) {
    const tenantId = this.requireTenantId()
    const project = await this.projectService.findProjectOrFail(projectId)
    const pages = await this.pageRepository.find({
      where: { seoProjectId: project.id, tenantId },
      order: { updatedAt: 'DESC' },
    })

    if (pages.length === 0 && project.landingPageId) {
      return [await this.legacyLinkedPage(project)]
    }

    const nameByWebsitePageId = await this.resolveBuilderPageNames(tenantId, pages)

    return pages.map((page) =>
      mapSeoProjectPageToDto(
        page,
        project,
        String(project.tenantId),
        page.websitePageId ? nameByWebsitePageId.get(page.websitePageId) : null,
      ),
    )
  }

  /**
   * Resolve real builder page names (as named in the editor) for linked pages.
   * Tenant-scoped: only reads lp_page rows owned by this tenant, so a page name
   * never leaks across accounts. One query for the whole list (no N+1).
   */
  private async resolveBuilderPageNames(
    tenantId: number,
    pages: SeoProjectPageEntity[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    if (!this.builderPageRepository) return result

    const ids = Array.from(
      new Set(pages.map((p) => p.websitePageId).filter((id): id is string => Boolean(id))),
    )
    if (ids.length === 0) return result

    const builders = await this.builderPageRepository.find({
      where: { tenantId, externalId: In(ids), isDelete: false },
    })
    for (const builder of builders) {
      if (builder.name?.trim()) {
        result.set(builder.externalId, builder.name.trim())
      }
    }
    return result
  }

  async link(projectId: string, dto: LinkLandingPageDto) {
    const tenantId = this.requireTenantId()
    const project = await this.projectService.findProjectOrFail(projectId)

    // Isolation: internal builder pages must belong to the same tenant
    if (dto.websitePageId && (dto.source === 'internal' || !dto.source)) {
      if (this.builderPageRepository) {
        const owned = await this.builderPageRepository.findOne({
          where: {
            tenantId,
            externalId: dto.websitePageId,
            isDelete: false,
          },
        })
        if (!owned && dto.source === 'internal') {
          throw new ForbiddenException('Landing page not found')
        }
      }
    }

    if (dto.websitePageId) {
      const existing = await this.pageRepository.findOne({
        where: {
          tenantId,
          seoProjectId: project.id,
          websitePageId: dto.websitePageId,
        },
      })
      if (existing) {
        return mapSeoProjectPageToDto(existing, project, String(tenantId))
      }
    }

    const page = await this.pageRepository.save(
      this.pageRepository.create({
        tenantId,
        seoProjectId: project.id,
        pageUrl: dto.pageUrl,
        websitePageId: dto.websitePageId ?? null,
        source: dto.source ?? 'external',
        scanStatus: 'pending',
        scores: {},
      }),
    )

    if (!project.landingPageId && dto.websitePageId) {
      project.landingPageId = dto.websitePageId
      await this.projectRepository.save(project)
    }

    return mapSeoProjectPageToDto(page, project, String(tenantId))
  }

  async unlink(projectId: string, pageId: string): Promise<void> {
    const tenantId = this.requireTenantId()
    await this.projectService.findProjectOrFail(projectId)

    const page = await this.pageRepository.findOne({
      where: { id: pageId, seoProjectId: projectId, tenantId },
    })
    if (!page) throw new NotFoundException('Landing page not found')

    await this.pageRepository.remove(page)
  }

  async detail(projectId: string, pageId: string) {
    const project = await this.projectService.findProjectOrFail(projectId)
    const page = await this.findPageOrFail(projectId, pageId)
    return mapSeoProjectPageToDto(page, project, String(project.tenantId))
  }

  async scan(
    projectId: string,
    pageId: string,
    dto: ScanProjectDto,
    authToken?: string | null,
  ) {
    const page = await this.findPageOrFail(projectId, pageId)
    page.scanStatus = 'scanning'
    await this.pageRepository.save(page)

    // Path C: Unlighthouse lab (tenant-scoped). OpenSEO hybrid remains on project scan.
    try {
      const lab = await this.labScanService.startLabScan(
        {
          trigger: 'list',
          depth: dto.depth === 'full' ? 'full' : 'quick',
          seoProjectId: projectId,
          seoProjectPageId: page.id,
          websitePageId: page.websitePageId ?? undefined,
          targetUrl: page.pageUrl || undefined,
          allowLocal: true,
        },
        authToken,
      )
      page.lastScanJobId = lab.jobId
      page.scanStatus =
        lab.status === 'success'
          ? 'completed'
          : lab.status === 'failed'
            ? 'failed'
            : 'scanning'
      if (lab.status === 'success') {
        page.lastScannedAt = new Date()
      }
      await this.pageRepository.save(page)
      return { jobId: lab.jobId, status: lab.status, mode: 'unlighthouse', targetUrl: lab.targetUrl }
    } catch {
      // Soft-fallback: existing hybrid project scan (domain + HTML)
      const result = await this.projectService.scan(projectId, dto)
      page.lastScanJobId = result.jobId
      page.scanStatus = 'scanning'
      await this.pageRepository.save(page)
      return { jobId: result.jobId, status: 'running', mode: result.mode ?? 'hybrid' }
    }
  }

  async scores(projectId: string, pageId: string) {
    const project = await this.projectService.findProjectOrFail(projectId)
    const page = await this.findPageOrFail(projectId, pageId)
    return mapLandingPageScores(page, project)
  }

  async tasks(projectId: string, pageId: string) {
    await this.findPageOrFail(projectId, pageId)
    const tasks = await this.taskService.listForProject(projectId)
    return tasks.map((task) => mapLandingPageTask(task, pageId, this.requireTenantId()))
  }

  async markScanComplete(projectId: string, jobId: string) {
    const page = await this.pageRepository.findOne({
      where: {
        seoProjectId: projectId,
        lastScanJobId: jobId,
        tenantId: this.requireTenantId(),
      },
    })
    if (!page) return

    const project = await this.projectService.findProjectOrFail(projectId)
    page.scanStatus = 'completed'
    page.lastScannedAt = new Date()
    page.scores = {
      graderScore: project.holisticScores?.aiGradeOverall ?? 0,
      contentScore: project.holisticScores?.contentScore ?? 0,
      technicalScore: project.holisticScores?.technicalsScore ?? 0,
      uxScore: project.holisticScores?.uxScore ?? 0,
      authorityScore: project.holisticScores?.authorityScore ?? 0,
    }
    await this.pageRepository.save(page)
  }

  private async findPageOrFail(projectId: string, pageId: string) {
    const page = await this.pageRepository.findOne({
      where: {
        id: pageId,
        seoProjectId: projectId,
        tenantId: this.requireTenantId(),
      },
    })
    if (!page) throw new NotFoundException('Landing page not found')
    return page
  }

  /** Tenant-scoped builder name for the legacy single-page link. */
  private async resolveLegacyBuilderName(
    project: SeoProjectEntity,
  ): Promise<string | null> {
    if (!this.builderPageRepository || !project.landingPageId) return null
    const builder = await this.builderPageRepository.findOne({
      where: {
        tenantId: project.tenantId,
        externalId: project.landingPageId,
        isDelete: false,
      },
    })
    return builder?.name?.trim() || null
  }

  private async legacyLinkedPage(project: SeoProjectEntity) {
    const isScanned = Boolean(project.lastAnalysisAt)
    const name = await this.resolveLegacyBuilderName(project)
    return {
      id: project.landingPageId!,
      organizationId: String(project.tenantId),
      aiSeoProjectId: project.id,
      projectId: project.id,
      websitePageId: project.landingPageId,
      name: name || project.name || project.hostname,
      pageUrl: project.hostname,
      pageType: 'landing_page',
      source: 'internal' as const,
      scanStatus: project.taskStatus === 'running' ? 'scanning' as const : project.lastAnalysisAt ? 'completed' as const : 'pending' as const,
      lastScanJobId: null,
      lastScannedAt: project.lastAnalysisAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      graderScore: isScanned ? Number(project.holisticScores?.aiGradeOverall ?? 0) : 0,
      contentScore: isScanned ? Number(project.holisticScores?.contentScore ?? 0) : 0,
      technicalScore: isScanned ? Number(project.holisticScores?.technicalsScore ?? 0) : 0,
      uxScore: isScanned ? Number(project.holisticScores?.uxScore ?? 0) : 0,
      authorityScore: isScanned ? Number(project.holisticScores?.authorityScore ?? 0) : 0,
    }
  }
}
