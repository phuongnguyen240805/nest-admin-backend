import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { randomUUID } from 'crypto'

import { BullMqEnqueueService, TenantContextService, UserService } from '@liora/nest-core'

import { isBullMqEnabled } from '../../../config/bullmq.app.config'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import type { CreateLandingAiJobDto } from '../dto/create-landing-ai-job.dto'
import { LANDING_AI_QUEUES } from '../queues/constants'
import type { LandingAiGeneratePayload } from '../types/landing-ai-job.payload'
import { LandingAiJobStoreService } from './landing-ai-job-store.service'
import { LandingAiQuotaService } from './landing-ai-quota.service'

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return slug || `page-${Date.now()}`
}

@Injectable()
export class LandingAiService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    private readonly jobStore: LandingAiJobStoreService,
    private readonly enqueue: BullMqEnqueueService,
    private readonly aiQuota: LandingAiQuotaService,
    private readonly userService: UserService,
  ) {
    super(tenantContext)
  }

  getAiQuota(userId: number) {
    return this.aiQuota.getSnapshot(String(userId))
  }

  async createJob(dto: CreateLandingAiJobDto, userId: number) {
    if (!isBullMqEnabled()) {
      throw new ServiceUnavailableException('BullMQ is disabled (BULLMQ_ENABLED=false)')
    }

    if (dto.type === 'clone') {
      const url = dto.params.url?.trim() ?? ''
      if (!url) {
        throw new BadRequestException('Clone job requires params.url')
      }
      if (url.toLowerCase().startsWith('file://')) {
        throw new BadRequestException('file:// URLs are not supported for clone jobs')
      }
    }

    const tenantId = this.requireTenantId()
    const organizationId = this.tenantContext.getOrganizationId()
    if (!organizationId) {
      throw new BadRequestException('Organization context is required')
    }

    const userKey = String(userId)
    const userEntity = await this.userService.findUserById(userId)
    const supabaseUserId = userEntity?.supabaseUserId ?? null
    if (!supabaseUserId) {
      throw new BadRequestException(
        'Account must be linked to Supabase before creating AI landing pages.',
      )
    }
    const jobId = randomUUID()
    const pageId = randomUUID()

    await this.aiQuota.assertCanCreateAiJob(userKey, jobId)

    let record: Awaited<ReturnType<LandingAiJobStoreService['createJob']>>
    try {
      record = await this.jobStore.createJob({
        id: jobId,
        tenantId,
        userId: userKey,
        pageId,
        type: dto.type,
        status: 'queued',
        progress: 0,
        payload: {
          ...dto,
          slug: slugifyName(dto.name),
        },
      })
    }
    catch (error) {
      this.aiQuota.releaseSlot(userKey, jobId)
      throw error
    }

    // Job đã ghi DB — reservation chỉ chặn race lúc enqueue song song
    this.aiQuota.releaseSlot(userKey, jobId)

    const payload: LandingAiGeneratePayload = {
      jobId,
      tenantId,
      organizationId,
      userId: userKey,
      supabaseUserId,
      pageId,
      type: dto.type,
      name: dto.name,
      tagIds: dto.tagIds,
      importMode: dto.importMode ?? 'preserve',
      params: dto.params,
    }

    try {
      const bullJob = await this.enqueue.add(
        LANDING_AI_QUEUES.GENERATE,
        'generate',
        payload,
        {
          jobId,
          priority: 10,
        },
      )

      await this.jobStore.updateJob(jobId, { bullJobId: String(bullJob.id) })
      await this.jobStore.appendEvent(jobId, 'Job đã được đưa vào hàng đợi', 0)
    }
    catch (error) {
      throw error
    }

    return {
      jobId: record.id,
      pageId: record.pageId,
      status: record.status,
    }
  }

  async getJob(jobId: string, userId: number) {
    const tenantId = this.requireTenantId()
    const job = await this.jobStore.findJobForTenantAndUser(jobId, tenantId, String(userId))
    if (!job) throw new NotFoundException('Landing AI job not found')

    return {
      jobId: job.id,
      pageId: job.pageId,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result ?? undefined,
      error: job.errorMessage ?? undefined,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
    }
  }

  async getJobEvents(jobId: string, userId: number) {
    const tenantId = this.requireTenantId()
    const job = await this.jobStore.findJobForTenantAndUser(jobId, tenantId, String(userId))
    if (!job) throw new NotFoundException('Landing AI job not found')

    const events = await this.jobStore.listEvents(jobId)
    return events.map((event) => ({
      id: event.id,
      message: event.message,
      progress: event.progress,
      createdAt: event.createdAt.toISOString(),
    }))
  }

  async cancelJob(jobId: string, userId: number) {
    const tenantId = this.requireTenantId()
    const job = await this.jobStore.findJobForTenantAndUser(jobId, tenantId, String(userId))
    if (!job) throw new NotFoundException('Landing AI job not found')

    if (job.status === 'success' || job.status === 'failed' || job.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel job in status ${job.status}`)
    }

    await this.enqueue.cancel(LANDING_AI_QUEUES.GENERATE, jobId)
    await this.jobStore.setStatus(jobId, 'cancelled', {
      completedAt: new Date(),
      progress: job.progress,
    })
    await this.jobStore.appendEvent(jobId, 'Job đã bị hủy bởi người dùng')

    return { jobId, status: 'cancelled' }
  }
}