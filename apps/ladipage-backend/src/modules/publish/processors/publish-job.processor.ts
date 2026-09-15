import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Job, Queue } from 'bullmq'
import { In, Repository } from 'typeorm'

import { BullMqProcessor, InjectBullQueue } from '@liora/nest-core'
import { BaseQueueProcessor } from '@liora/nest-core/modules/bullmq/base/base-queue.processor'

import { LandingPageService } from '../../landing-cms/application/landing-page.service'
import { PublishJobEntity } from '../entities'
import {
  PUBLISH_JOB_NAME,
  PUBLISH_MAX_ATTEMPTS,
  PUBLISH_QUEUE,
  type LandingPublishQueuePayload,
} from '../queues/constants'
import { PublishExecutorClient } from '../services/publish-executor.client'

@BullMqProcessor(PUBLISH_QUEUE)
export class PublishJobProcessor extends BaseQueueProcessor<LandingPublishQueuePayload> {
  constructor(
    @InjectRepository(PublishJobEntity)
    private readonly jobRepository: Repository<PublishJobEntity>,
    private readonly executorClient: PublishExecutorClient,
    private readonly landingPageService: LandingPageService,
  ) {
    super()
  }

  protected async processJob(job: Job<LandingPublishQueuePayload>): Promise<void> {
    if (job.name !== PUBLISH_JOB_NAME) return

    const record = await this.jobRepository.findOne({ where: { jobId: job.data.jobId } })
    if (!record) {
      this.logger.warn(`Publish job row missing: ${job.data.jobId}`)
      return
    }
    if (record.status === 'published' || record.status === 'failed_final' || record.status === 'cancelled') return

    // Latest intent wins if queue delivery/retry order is ever inverted across
    // worker replicas. A stale queued publish must not overwrite a newer draft.
    const newer = await this.jobRepository
      .createQueryBuilder('publishJob')
      .where('publishJob.tenantId = :tenantId', { tenantId: record.tenantId })
      .andWhere('publishJob.pageId = :pageId', { pageId: record.pageId })
      .andWhere('publishJob.id > :jobRowId', { jobRowId: record.id })
      .orderBy('publishJob.id', 'DESC')
      .getOne()
    if (newer) {
      await this.updateRecord(record, {
        status: 'cancelled',
        step: 'superseded',
        progress: 100,
        errorCode: 'PUBLISH_SUPERSEDED',
        errorMessage: `Superseded by newer publish job ${newer.jobId}`,
        finishedAt: new Date(),
      })
      await this.updateProgress(job, 100)
      return
    }

    await this.updateRecord(record, {
      status: 'validating',
      step: 'validating',
      progress: 10,
      startedAt: record.startedAt ?? new Date(),
      queueAttempts: Math.max(record.queueAttempts + 1, job.attemptsMade + 1),
      errorCode: null,
      errorMessage: null,
    })
    await this.updateProgress(job, 10)

    let instaticHtml: string | null = null
    try {
      const artifact = await this.landingPageService.getPublishedArtifact(record.pageId, record.userId)
      instaticHtml = artifact.html
    }
    catch {
      // Visual-editor pages and Instatic pages without a mapping continue through
      // the executor's existing renderer/fallback rules.
    }

    await this.updateRecord(record, {
      status: 'rendering',
      step: 'rendering_and_edge_delivery',
      progress: 30,
    })
    await this.updateProgress(job, 30)

    try {
      const result = await this.executorClient.execute({
        jobId: record.jobId,
        jobSequence: record.id,
        pageId: record.pageId,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
        userId: record.userId,
        ownerId: record.ownerId,
        payload: record.payload,
        instaticHtml,
      })

      const attempts = Number(job.opts.attempts ?? 1)
      const hasRetry = job.attemptsMade + 1 < attempts
      if (
        result.edgeSyncStatus === 'error' &&
        result.edgeRetryable !== false &&
        hasRetry
      ) {
        throw Object.assign(new Error('Edge artifact delivery failed; retrying publish reconciliation'), {
          code: 'EDGE_PUBLISH_RETRY',
          retryable: true,
        })
      }

      await this.updateRecord(record, {
        status: 'published',
        step: 'published',
        progress: 100,
        result,
        errorCode: null,
        errorMessage: null,
        finishedAt: new Date(),
      })
      await this.updateProgress(job, 100)
    }
    catch (error) {
      const attempts = Number(job.opts.attempts ?? 1)
      const hasRetry = job.attemptsMade + 1 < attempts
      const retryable = (error as { retryable?: boolean }).retryable !== false
      const errorCode = String((error as { code?: unknown }).code ?? 'PUBLISH_FAILED').slice(0, 64)
      if (errorCode === 'PUBLISH_SUPERSEDED') {
        await this.updateRecord(record, {
          status: 'cancelled',
          step: 'superseded',
          progress: 100,
          errorCode,
          errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 4000),
          finishedAt: new Date(),
        })
        await this.updateProgress(job, 100)
        return
      }

      const final = !hasRetry || !retryable
      if (!retryable) job.discard()
      await this.updateRecord(record, {
        status: final ? 'failed_final' : 'failed_retryable',
        step: final ? 'failed_final' : 'retry_wait',
        progress: final ? record.progress : Math.min(record.progress, 30),
        errorCode,
        errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 4000),
        ...(final ? { finishedAt: new Date() } : {}),
      })
      throw error
    }
  }

  private async updateRecord(
    record: PublishJobEntity,
    patch: Partial<PublishJobEntity>,
  ): Promise<void> {
    Object.assign(record, patch)
    await this.jobRepository.save(record)
  }
}

/**
 * DB-backed queue reconciliation. The API commits the publish row before the
 * BullMQ add call, so a temporary Redis outage cannot lose the user's publish.
 * Deterministic BullMQ jobId makes redispatch idempotent.
 */
@Injectable()
export class PublishQueueReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PublishQueueReconciler.name)
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    @InjectRepository(PublishJobEntity)
    private readonly jobRepository: Repository<PublishJobEntity>,
    @InjectBullQueue(PUBLISH_QUEUE)
    private readonly queue: Queue,
  ) {}

  onApplicationBootstrap(): void {
    const configuredInterval = Number(process.env.LANDING_PUBLISH_RECONCILE_INTERVAL_MS)
    const intervalMs = Number.isFinite(configuredInterval) && configuredInterval > 0
      ? Math.max(5_000, Math.min(configuredInterval, 5 * 60_000))
      : 15_000
    this.timer = setInterval(() => void this.reconcile(), intervalMs)
    this.timer.unref?.()
    void this.reconcile()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async reconcile(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const rows = await this.jobRepository.find({
        where: { status: In(['queued', 'failed_retryable']) },
        order: { createdAt: 'ASC' },
        take: 50,
      })
      for (const row of rows) {
        const existing = await this.queue.getJob(row.jobId)
        if (existing) continue
        await this.queue.add(
          PUBLISH_JOB_NAME,
          { jobId: row.jobId },
          {
            jobId: row.jobId,
            attempts: Math.max(1, PUBLISH_MAX_ATTEMPTS - row.queueAttempts),
            backoff: { type: 'exponential', delay: 3_000 },
            removeOnComplete: 500,
            removeOnFail: 2_000,
          },
        )
      }
    }
    catch (error) {
      this.logger.warn(
        `Publish queue reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    finally {
      this.running = false
    }
  }
}
