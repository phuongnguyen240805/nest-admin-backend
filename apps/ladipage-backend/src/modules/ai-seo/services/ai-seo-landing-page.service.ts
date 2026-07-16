import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

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
  ) {
    super(tenantContext)
  }

  async list(projectId: string) {
    const project = await this.projectService.findProjectOrFail(projectId)
    const pages = await this.pageRepository.find({
      where: { seoProjectId: project.id, tenantId: this.requireTenantId() },
      order: { updatedAt: 'DESC' },
    })

    if (pages.length === 0 && project.landingPageId) {
      return [this.legacyLinkedPage(project)]
    }

    return pages.map((page) => mapSeoProjectPageToDto(page, project, String(project.tenantId)))
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

  async scan(projectId: string, pageId: string, dto: ScanProjectDto) {
    const page = await this.findPageOrFail(projectId, pageId)
    page.scanStatus = 'scanning'
    await this.pageRepository.save(page)

    const result = await this.projectService.scan(projectId, dto)
    page.lastScanJobId = result.jobId
    page.scanStatus = 'scanning'
    await this.pageRepository.save(page)

    return { jobId: result.jobId, status: 'running' }
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

  private legacyLinkedPage(project: SeoProjectEntity) {
    return {
      id: project.landingPageId!,
      organizationId: String(project.tenantId),
      aiSeoProjectId: project.id,
      projectId: project.id,
      websitePageId: project.landingPageId,
      pageUrl: project.hostname,
      pageType: 'landing_page',
      source: 'internal' as const,
      scanStatus: project.taskStatus === 'running' ? 'scanning' as const : project.lastAnalysisAt ? 'completed' as const : 'pending' as const,
      lastScanJobId: null,
      lastScannedAt: project.lastAnalysisAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      graderScore: Number(project.holisticScores?.aiGradeOverall ?? 0),
      contentScore: Number(project.holisticScores?.contentScore ?? 0),
      technicalScore: Number(project.holisticScores?.technicalsScore ?? 0),
      uxScore: Number(project.holisticScores?.uxScore ?? 0),
      authorityScore: Number(project.holisticScores?.authorityScore ?? 0),
    }
  }
}