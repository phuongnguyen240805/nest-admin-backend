import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import type { AdsOperationState } from '@liora/ads-contracts'

import { AdsJobEntity } from '../entities'

const ALLOWED_TRANSITIONS: Record<AdsOperationState, readonly AdsOperationState[]> = {
  CREATED: ['AUTHORIZED', 'VALIDATING', 'QUEUED', 'CANCELLED'],
  AUTHORIZED: ['VALIDATING', 'QUEUED', 'FAILED', 'CANCELLED'],
  VALIDATING: ['QUEUED', 'RUNNING', 'FAILED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'FAILED', 'CANCELLED'],
  RUNNING: ['RECONCILING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'],
  RECONCILING: ['SUCCEEDED', 'PARTIAL', 'FAILED'],
  SUCCEEDED: [],
  PARTIAL: ['RECONCILING'],
  FAILED: ['QUEUED'],
  CANCELLED: [],
}

@Injectable()
export class AdsJobStoreService {
  constructor(
    @InjectRepository(AdsJobEntity)
    private readonly jobRepository: Repository<AdsJobEntity>,
  ) {}

  async create(input: Partial<AdsJobEntity>): Promise<AdsJobEntity> {
    return this.jobRepository.save(this.jobRepository.create(input))
  }

  async createIdempotent(
    input: Partial<AdsJobEntity> & { tenantId: number; idempotencyKey: string },
  ): Promise<{ job: AdsJobEntity; created: boolean }> {
    try {
      return { job: await this.create(input), created: true }
    } catch (error) {
      const databaseError = error as { code?: string; constraint?: string }
      if (
        databaseError.code !== '23505' ||
        databaseError.constraint !== 'uq_lp_ads_job_idempotency'
      ) {
        throw error
      }
      const existing = await this.findByIdempotency(input.tenantId, input.idempotencyKey)
      if (!existing) throw error
      return { job: existing, created: false }
    }
  }

  async findById(id: string): Promise<AdsJobEntity> {
    const job = await this.jobRepository.findOneBy({ id })
    if (!job) throw new NotFoundException('Ads job was not found')
    return job
  }

  async findForTenant(id: string, tenantId: number): Promise<AdsJobEntity> {
    const job = await this.jobRepository.findOneBy({ id, tenantId })
    if (!job) throw new NotFoundException('Ads job was not found')
    return job
  }

  async findByIdempotency(tenantId: number, idempotencyKey: string): Promise<AdsJobEntity | null> {
    return this.jobRepository.findOneBy({ tenantId, idempotencyKey })
  }

  async transition(
    job: AdsJobEntity,
    next: AdsOperationState,
    patch: Partial<AdsJobEntity> = {},
  ): Promise<AdsJobEntity> {
    if (job.state !== next && !ALLOWED_TRANSITIONS[job.state].includes(next)) {
      throw new BadRequestException(`Invalid ads job transition ${job.state} -> ${next}`)
    }
    Object.assign(job, patch, { state: next })
    if (['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(next)) {
      job.completedAt = patch.completedAt ?? new Date()
    }
    return this.jobRepository.save(job)
  }

  async saveCheckpoint(
    job: AdsJobEntity,
    checkpoint: Record<string, unknown>,
  ): Promise<AdsJobEntity> {
    job.checkpoint = checkpoint
    return this.jobRepository.save(job)
  }
}
