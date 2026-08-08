import { randomUUID } from 'node:crypto'

import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { BullMqEnqueueService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import type { AdsProvider } from '@liora/ads-contracts'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { isBullMqEnabled } from '../../../config/bullmq.app.config'
import { AdsFingerprintService } from '../core/ads-fingerprint.service'
import { AdsProviderRegistry } from '../core/ads-provider-registry.service'
import { AdsAccountEntity, AdsConnectionEntity, AdsJobEntity } from '../entities'
import { ADS_PLATFORM_QUEUES } from '../queues/constants'
import { AdsJobStoreService } from './ads-job-store.service'

@Injectable()
export class AdsJobService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(AdsConnectionEntity)
    private readonly connections: Repository<AdsConnectionEntity>,
    @InjectRepository(AdsAccountEntity)
    private readonly accounts: Repository<AdsAccountEntity>,
    private readonly jobs: AdsJobStoreService,
    private readonly fingerprint: AdsFingerprintService,
    private readonly registry: AdsProviderRegistry,
    private readonly moduleRef: ModuleRef,
  ) {
    super(tenantContext)
  }

  async createSyncJob(input: {
    provider: AdsProvider
    connectionId: string
    externalAccountId: string
    resource: 'CAMPAIGNS' | 'PERFORMANCE'
    since?: string
    until?: string
    idempotencyKey: string
  }, actorId: string) {
    return this.createAndEnqueue(
      {
        provider: input.provider,
        type: 'SYNC',
        connectionId: input.connectionId,
        externalAccountId: input.externalAccountId,
        idempotencyKey: input.idempotencyKey,
        payload: {
          resource: input.resource,
          since: input.since,
          until: input.until,
        },
      },
      actorId,
    )
  }

  async createPublishJob(input: {
    provider: AdsProvider
    connectionId: string
    externalAccountId: string
    idempotencyKey: string
    revision: number
    draft: Record<string, unknown>
  }, actorId: string) {
    return this.createAndEnqueue(
      {
        provider: input.provider,
        type: 'PUBLISH',
        connectionId: input.connectionId,
        externalAccountId: input.externalAccountId,
        idempotencyKey: input.idempotencyKey,
        payload: {
          revision: input.revision,
          draftHash: this.fingerprint.hash(input.draft),
          draft: input.draft,
        },
      },
      actorId,
    )
  }

  async getJob(id: string) {
    return this.jobs.findForTenant(id, this.requireTenantId())
  }

  private async createAndEnqueue(
    input: Pick<
      AdsJobEntity,
      'provider' | 'type' | 'connectionId' | 'externalAccountId' | 'idempotencyKey' | 'payload'
    >,
    actorId: string,
  ) {
    if (!isBullMqEnabled()) {
      throw new ServiceUnavailableException('Ads operations require BullMQ (BULLMQ_ENABLED=true)')
    }
    const tenantId = this.requireTenantId()
    await this.assertTargetOwnership(tenantId, input)
    this.registry.requireCapability(
      input.provider,
      input.type === 'PUBLISH'
        ? 'PUBLISH'
        : input.payload.resource === 'PERFORMANCE'
          ? 'PERFORMANCE_SYNC'
          : 'ASSET_SYNC',
    )
    const existing = await this.jobs.findByIdempotency(tenantId, input.idempotencyKey)
    if (existing) return existing

    const created = await this.jobs.createIdempotent({
      id: randomUUID(),
      tenantId,
      actorId,
      ...input,
      state: 'QUEUED',
      checkpoint: {},
      result: null,
      error: null,
      bullJobId: null,
      completedAt: null,
    })
    if (!created.created) return created.job
    const job = created.job
    try {
      const enqueue = this.moduleRef.get(BullMqEnqueueService, { strict: false })
      const bullJob = await enqueue.add(
        ADS_PLATFORM_QUEUES.OPERATIONS,
        input.type.toLowerCase(),
        { jobId: job.id },
        { jobId: job.id, attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
      )
      job.bullJobId = String(bullJob.id)
      return this.jobs.transition(job, 'QUEUED')
    } catch (error) {
      await this.jobs.transition(job, 'FAILED', {
        error: {
          code: 'QUEUE_ENQUEUE_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  private async assertTargetOwnership(
    tenantId: number,
    input: Pick<AdsJobEntity, 'provider' | 'connectionId' | 'externalAccountId'>,
  ): Promise<void> {
    if (!input.connectionId || !input.externalAccountId) {
      throw new NotFoundException('Ads connection and account are required')
    }
    const connection = await this.connections.findOneBy({
      id: input.connectionId,
      tenantId,
      provider: input.provider,
      status: 'CONNECTED',
    })
    if (!connection) throw new NotFoundException('Active ads connection was not found')
    const account = await this.accounts.findOneBy({
      tenantId,
      connectionId: connection.id,
      provider: input.provider,
      externalId: input.externalAccountId,
    })
    if (!account) throw new NotFoundException('Ads account was not found for this connection')
  }
}
