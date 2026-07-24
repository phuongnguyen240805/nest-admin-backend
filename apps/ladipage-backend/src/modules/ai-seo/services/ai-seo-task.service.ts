import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { SeoTaskActionDto } from '../dto/seo-task-action.dto'
import { SeoProjectEntity, SeoProjectPageEntity, SeoTaskEntity } from '../entities'

@Injectable()
export class AiSeoTaskService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoTaskEntity)
    private readonly taskRepository: Repository<SeoTaskEntity>,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    @InjectRepository(SeoProjectPageEntity)
    private readonly projectPageRepository: Repository<SeoProjectPageEntity>,
  ) {
    super(tenantContext)
  }

  async listForProject(projectId: string) {
    await this.assertProject(projectId)
    const tasks = await this.taskRepository.find({
      where: { seoProjectId: projectId },
      order: { updatedAt: 'DESC' },
    })
    return tasks.map((task) => this.mapTask(task))
  }

  async listForLandingPage(projectId: string, pageId: string) {
    const project = await this.assertProject(projectId)
    if (project.landingPageId && project.landingPageId !== pageId) {
      throw new NotFoundException('Landing page not found')
    }
    return this.listForProject(projectId)
  }

  approve(id: string, dto: SeoTaskActionDto) {
    return this.updateStatus(id, 'approved', dto)
  }

  reject(id: string, dto: SeoTaskActionDto) {
    return this.updateStatus(id, 'rejected', dto)
  }

  async updateFeStatus(id: string, status: 'todo' | 'in_progress' | 'completed') {
    const task = await this.findTaskOrFail(id)
    task.result = {
      ...(task.result ?? {}),
      feStatus: status,
    }

    if (status === 'completed') {
      task.status = 'approved'
    } else {
      task.status = 'pending'
    }

    return this.mapTask(await this.taskRepository.save(task))
  }

  async deploy(id: string, dto: SeoTaskActionDto) {
    const task = await this.findTaskOrFail(id)
    const deployPayload = (dto.payload ?? {}) as Record<string, unknown>
    const taskPayload = (task.payload ?? {}) as Record<string, unknown>
    // Explicit Record so meta fields are assignable under strict TS (docker build)
    const mergedResult: Record<string, unknown> = {
      ...(task.result ?? {}),
      ...deployPayload,
      reason: dto.reason ?? (task.result ?? {}).reason,
      deployedAt: new Date().toISOString(),
    }
    if (deployPayload.metaTitle != null) mergedResult.metaTitle = deployPayload.metaTitle
    if (deployPayload.metaDescription != null) {
      mergedResult.metaDescription = deployPayload.metaDescription
    }
    if (mergedResult.metaTitle == null && taskPayload.suggested != null) {
      mergedResult.metaTitle = taskPayload.suggested
    }
    task.status = 'deployed'
    task.result = mergedResult

    const saved = await this.taskRepository.save(task)
    await this.applyDeploySuggestions(task.project, saved)
    return this.mapTask(saved)
  }

  private async updateStatus(
    id: string,
    status: SeoTaskEntity['status'],
    dto: SeoTaskActionDto,
  ) {
    const task = await this.findTaskOrFail(id)
    task.status = status
    task.result = {
      ...(task.result ?? {}),
      ...(dto.payload ?? {}),
      reason: dto.reason ?? (task.result ?? {}).reason,
    }
    return this.mapTask(await this.taskRepository.save(task))
  }

  private async applyDeploySuggestions(project: SeoProjectEntity, task: SeoTaskEntity) {
    const suggestion = (task.result ?? {}) as Record<string, unknown>
    const payload = (task.payload ?? {}) as Record<string, unknown>
    const metaTitle = (suggestion.metaTitle ?? suggestion.title ?? null) as string | null
    const metaDescription = (suggestion.metaDescription ??
      suggestion.description ??
      null) as string | null
    const deployedAt = suggestion.deployedAt ?? null

    project.siteAudit = {
      ...(project.siteAudit ?? {}),
      deployedSuggestions: {
        taskId: task.id,
        metaTitle,
        metaDescription,
        deployedAt,
        websitePageId: payload.websitePageId ?? project.landingPageId ?? null,
      },
      publishedMeta: {
        title: metaTitle,
        description: metaDescription,
        updatedAt: deployedAt,
      },
    }
    await this.projectRepository.save(project)

    const websitePageId =
      (typeof payload.websitePageId === 'string' ? payload.websitePageId : null) ||
      project.landingPageId

    if (websitePageId) {
      const linkedPage = await this.projectPageRepository.findOne({
        where: {
          seoProjectId: project.id,
          websitePageId,
          tenantId: project.tenantId,
        },
      })
      if (linkedPage) {
        linkedPage.scores = {
          ...(linkedPage.scores ?? {}),
          lastDeployedTaskId: task.id,
          metaTitle,
          metaDescription,
          publishedMeta: {
            title: metaTitle,
            description: metaDescription,
          },
        }
        await this.projectPageRepository.save(linkedPage)
      }
    }
  }

  private async findTaskOrFail(id: string): Promise<SeoTaskEntity> {
    const task = await this.taskRepository
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.project', 'project')
      .where('task.id = :id', { id })
      .andWhere('project.tenantId = :tenantId', { tenantId: this.requireTenantId() })
      .getOne()

    if (!task) throw new NotFoundException('SEO task not found')
    return task
  }

  private async assertProject(projectId: string): Promise<SeoProjectEntity> {
    const project = await this.projectRepository.findOne({
      where: {
        id: projectId,
        tenantId: this.requireTenantId(),
      },
    })
    if (!project) throw new NotFoundException('SEO project not found')
    return project
  }

  private mapTask(task: SeoTaskEntity) {
    return {
      id: task.id,
      projectId: task.seoProjectId,
      externalTaskId: task.externalTaskId,
      type: task.type,
      status: task.status,
      payload: task.payload ?? {},
      result: task.result ?? {},
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }
  }
}
