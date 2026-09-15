import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import {
  BullMqEnqueueService,
  TenantContextService,
  UserService,
} from '@liora/nest-core'

import { CreatePublishJobDto } from '../dto/create-publish-job.dto'
import { PageEntity, PublishJobEntity } from '../entities'
import { PUBLISH_JOB_NAME, PUBLISH_MAX_ATTEMPTS, PUBLISH_QUEUE } from '../queues/constants'
import { PublishExecutorClient } from './publish-executor.client'

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

function stableJson(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
}

function requestHash(pageId: string, payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableJson({ pageId, payload })).digest('hex')
}

@Injectable()
export class PublishJobService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly userService: UserService,
    @Optional()
    @Inject(BullMqEnqueueService)
    private readonly enqueueService: BullMqEnqueueService | undefined,
    private readonly executorClient: PublishExecutorClient,
    @InjectRepository(PublishJobEntity)
    private readonly jobRepository: Repository<PublishJobEntity>,
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity>,
  ) {}

  async createOrReplay(input: {
    pageId: string
    userId: number
    idempotencyKey: string
    dto: CreatePublishJobDto
  }): Promise<PublishJobEntity> {
    const tenantId = this.requireTenantId()
    const organizationId = this.tenantContext.getOrganizationId() ?? null
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
      throw new UnprocessableEntityException('A valid Idempotency-Key is required')
    }
    if (!this.enqueueService) {
      throw new ServiceUnavailableException('BullMQ is disabled')
    }
    if (!this.executorClient.isConfigured()) {
      throw new ServiceUnavailableException('Async publish executor is not configured')
    }

    const user = await this.userService.findUserById(input.userId)
    const ownerId = user?.supabaseUserId
    if (!ownerId) {
      throw new UnprocessableEntityException('Account is not linked to a landing-page owner')
    }

    await this.assertTenantPageIfPresent(tenantId, input.pageId)

    const payload = { ...input.dto } as Record<string, unknown>
    const hash = requestHash(input.pageId, payload)
    const existing = await this.jobRepository.findOne({
      where: {
        tenantId,
        userId: input.userId,
        pageId: input.pageId,
        idempotencyKey: input.idempotencyKey,
      },
    })
    if (existing) {
      if (existing.requestHash !== hash) {
        throw new ConflictException('Idempotency-Key was already used with a different payload')
      }
      if (existing.status === 'queued' || existing.status === 'failed_retryable') {
        await this.enqueue(existing).catch(() => undefined)
      }
      return existing
    }

    const job = this.jobRepository.create({
      jobId: `pub_${randomUUID().replace(/-/g, '')}`,
      tenantId,
      userId: input.userId,
      ownerId,
      pageId: input.pageId,
      organizationId,
      idempotencyKey: input.idempotencyKey,
      requestHash: hash,
      status: 'queued',
      step: 'queued',
      progress: 0,
      payload,
      result: null,
      errorCode: null,
      errorMessage: null,
      queueAttempts: 0,
      createBy: input.userId,
      updateBy: input.userId,
    })

    let saved: PublishJobEntity
    try {
      saved = await this.jobRepository.save(job)
    }
    catch (error) {
      // A concurrent retry may win the unique key. Re-read and apply the same
      // request-hash protection instead of creating a duplicate publish.
      const raced = await this.jobRepository.findOne({
        where: {
          tenantId,
          userId: input.userId,
          pageId: input.pageId,
          idempotencyKey: input.idempotencyKey,
        },
      })
      if (!raced) throw error
      if (raced.requestHash !== hash) {
        throw new ConflictException('Idempotency-Key was already used with a different payload')
      }
      saved = raced
    }

    // Database is the source of truth. Queue dispatch is best-effort here;
    // worker reconciliation retries queued rows with deterministic BullMQ jobId.
    await this.enqueue(saved).catch(() => undefined)
    return saved
  }

  async getForUser(jobId: string, userId: number): Promise<PublishJobEntity> {
    const tenantId = this.requireTenantId()
    const job = await this.jobRepository.findOne({ where: { jobId, tenantId, userId } })
    if (!job) throw new NotFoundException('Publish job not found')
    return job
  }

  toPublic(job: PublishJobEntity) {
    return {
      jobId: job.jobId,
      pageId: job.pageId,
      status: job.status,
      step: job.step,
      progress: job.progress,
      result: job.status === 'published' ? job.result : null,
      error: job.status === 'failed_final' || job.status === 'cancelled'
        ? { code: job.errorCode, message: job.errorMessage }
        : null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      finishedAt: job.finishedAt,
    }
  }

  async enqueue(job: PublishJobEntity): Promise<void> {
    if (!this.enqueueService) {
      throw new ServiceUnavailableException('BullMQ is disabled')
    }
    await this.enqueueService.add(
      PUBLISH_QUEUE,
      PUBLISH_JOB_NAME,
      { jobId: job.jobId },
      {
        jobId: job.jobId,
        attempts: Math.max(1, PUBLISH_MAX_ATTEMPTS - job.queueAttempts),
        backoff: { type: 'exponential', delay: 3_000 },
        removeOnComplete: 500,
        removeOnFail: 2_000,
      },
    )
  }

  private async assertTenantPageIfPresent(tenantId: number, pageId: string): Promise<void> {
    const anyPage = await this.pageRepository.findOne({
      where: { externalId: pageId, isDelete: false },
      select: { id: true, tenantId: true },
    })
    if (anyPage && anyPage.tenantId !== tenantId) {
      throw new NotFoundException('Landing page not found')
    }
  }

  private requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) throw new NotFoundException('Landing page not found')
    return tenantId
  }
}
