import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { SeoProjectEntity, SeoTaskEntity } from '../entities'
import { AiSeoLandingPageService } from './ai-seo-landing-page.service'
import { OpenSeoClientService } from './openseo-client.service'

@Injectable()
export class AiSeoJobsService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoTaskEntity)
    private readonly taskRepository: Repository<SeoTaskEntity>,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    private readonly openSeoClient: OpenSeoClientService,
    private readonly landingPageService: AiSeoLandingPageService,
  ) {
    super(tenantContext)
  }

  async getJobEvents(jobId: string) {
    const task = await this.findTaskByJobId(jobId)
    const events = [
      {
        id: `${task.id}-created`,
        job_id: jobId,
        message: `Audit job ${task.type} queued`,
        created_at: task.createdAt.toISOString(),
      },
    ]

    if (task.status !== 'pending') {
      events.push({
        id: `${task.id}-updated`,
        job_id: jobId,
        message: `Task status: ${task.status}`,
        created_at: task.updatedAt.toISOString(),
      })
    }

    if (task.result && Object.keys(task.result).length > 0) {
      events.push({
        id: `${task.id}-result`,
        job_id: jobId,
        message: 'Audit results synced',
        created_at: task.updatedAt.toISOString(),
      })
    }

    return events
  }

  async getJob(jobId: string) {
    const task = await this.findTaskByJobId(jobId)
    const project = task.project

    // Domain-overview scans are completed at create time — return stored result.
    if (
      jobId.startsWith('domain-overview-') &&
      (task.status === 'approved' || task.status === 'deployed') &&
      task.result &&
      Object.keys(task.result).length > 0
    ) {
      return {
        jobId,
        taskId: task.id,
        projectId: project.id,
        status: 'success',
        progress: 100,
        result: task.result,
      }
    }

    try {
      const status = await this.openSeoClient.getAuditStatus(jobId)
      if (this.isComplete(status.status) && project.openseoProjectId) {
        await this.syncAuditResult(project, task, jobId)
      }

      return {
        jobId,
        taskId: task.id,
        projectId: project.id,
        status: this.normalizeJobStatus(status.status),
        progress: status.progress ?? null,
        result: task.result ?? {},
      }
    } catch {
      return {
        jobId,
        taskId: task.id,
        projectId: project.id,
        status: this.normalizeJobStatus(task.status),
        progress: null,
        result: task.result ?? {},
      }
    }
  }

  private normalizeJobStatus(status: string): string {
    const normalized = status.toLowerCase()
    if (this.isComplete(normalized)) return 'success'
    if (['failed', 'error'].includes(normalized)) return 'failed'
    if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled'
    if (['running', 'started', 'in_progress'].includes(normalized)) return 'running'
    if (['pending', 'queued'].includes(normalized)) return 'queued'
    return status
  }

  private async findTaskByJobId(jobId: string): Promise<SeoTaskEntity> {
    const task = await this.taskRepository
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.project', 'project')
      .where('task.externalTaskId = :jobId', { jobId })
      .andWhere('project.tenantId = :tenantId', { tenantId: this.requireTenantId() })
      .getOne()

    if (!task) throw new NotFoundException('SEO job not found')
    return task
  }

  private async syncAuditResult(project: SeoProjectEntity, task: SeoTaskEntity, jobId: string) {
    const auditResult = await this.openSeoClient.getAuditResults(project.openseoProjectId!, jobId)
    const scores = this.extractScores(auditResult)

    project.holisticScores = {
      ...(project.holisticScores ?? {}),
      ...scores,
    }
    project.siteAudit = auditResult
    project.taskStatus = 'done'
    project.lastAnalysisAt = new Date()
    task.result = auditResult

    await Promise.all([
      this.projectRepository.save(project),
      this.taskRepository.save(task),
    ])

    await this.landingPageService.markScanComplete(project.id, jobId)
  }

  private extractScores(result: Record<string, unknown>): Record<string, number> {
    const source = (result.scores ?? result.holisticScores ?? result) as Record<string, unknown>
    return {
      technicalsScore: this.score(source.technicalsScore ?? source.technicalScore ?? source.technical),
      uxScore: this.score(source.uxScore ?? source.performanceScore ?? source.ux),
      authorityScore: this.score(source.authorityScore ?? source.authority),
      contentScore: this.score(source.contentScore ?? source.content),
    }
  }

  private score(value: unknown): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(100, Math.round(parsed)))
  }

  private isComplete(status: string): boolean {
    return ['done', 'completed', 'complete', 'success', 'succeeded'].includes(status.toLowerCase())
  }
}
