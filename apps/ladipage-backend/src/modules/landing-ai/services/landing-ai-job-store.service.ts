import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'

import { LandingAiJobEventEntity, LandingAiJobEntity } from '../entities'
import type { LandingAiJobStatus } from '../queues/constants'

@Injectable()
export class LandingAiJobStoreService {
  constructor(
    @InjectRepository(LandingAiJobEntity)
    private readonly jobRepository: Repository<LandingAiJobEntity>,
    @InjectRepository(LandingAiJobEventEntity)
    private readonly eventRepository: Repository<LandingAiJobEventEntity>,
  ) {}

  createJob(input: Partial<LandingAiJobEntity>): Promise<LandingAiJobEntity> {
    const entity = this.jobRepository.create(input)
    return this.jobRepository.save(entity)
  }

  async findJobForTenant(jobId: string, tenantId: number): Promise<LandingAiJobEntity | null> {
    return this.jobRepository.findOne({ where: { id: jobId, tenantId } })
  }

  async findJobForTenantAndUser(
    jobId: string,
    tenantId: number,
    userId: string,
  ): Promise<LandingAiJobEntity | null> {
    return this.jobRepository.findOne({ where: { id: jobId, tenantId, userId } })
  }

  async appendEvent(
    jobId: string,
    message: string,
    progress?: number,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.eventRepository.save(
      this.eventRepository.create({
        jobId,
        message,
        progress: progress ?? null,
        meta: meta ?? null,
      }),
    )
  }

  async updateJob(
    jobId: string,
    patch: Partial<LandingAiJobEntity>,
  ): Promise<void> {
    await this.jobRepository.update({ id: jobId }, patch)
  }

  async setStatus(
    jobId: string,
    status: LandingAiJobStatus,
    patch?: Partial<LandingAiJobEntity>,
  ): Promise<void> {
    await this.updateJob(jobId, { status, ...patch })
  }

  listEvents(jobId: string): Promise<LandingAiJobEventEntity[]> {
    return this.eventRepository.find({
      where: { jobId },
      order: { createdAt: 'ASC' },
    })
  }

  /** Đếm job AI theo tài khoản — job cancelled không tính (user hủy được slot lại). */
  countJobsForUser(userId: string): Promise<number> {
    return this.jobRepository.count({
      where: {
        userId,
        status: Not('cancelled' as LandingAiJobStatus),
      },
    })
  }
}