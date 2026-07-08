import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Not } from 'typeorm'

import { LandingAiJobStoreService } from './landing-ai-job-store.service'

type ReservationBucket = {
  jobIds: Set<string>
}

export type LandingAiQuotaSnapshot = {
  used: number
  reserved: number
  limit: number
  remaining: number
}

@Injectable()
export class LandingAiQuotaService {
  private readonly reservations = new Map<string, ReservationBucket>()

  constructor(
    private readonly jobStore: LandingAiJobStoreService,
    private readonly configService: ConfigService,
  ) {}

  getLimit(): number {
    const raw = Number(this.configService.get<string>('LANDING_AI_JOBS_PER_USER') ?? 5)
    return Number.isFinite(raw) ? raw : 5
  }

  isUnlimited(limit = this.getLimit()): boolean {
    return limit <= 0
  }

  async countJobsForUser(userId: string): Promise<number> {
    return this.jobStore.countJobsForUser(userId)
  }

  private getReservedCount(userId: string): number {
    return this.reservations.get(userId)?.jobIds.size ?? 0
  }

  reserveSlot(userId: string, jobId: string): void {
    const bucket = this.reservations.get(userId) ?? { jobIds: new Set<string>() }
    bucket.jobIds.add(jobId)
    this.reservations.set(userId, bucket)
  }

  releaseSlot(userId: string, jobId: string): void {
    const bucket = this.reservations.get(userId)
    if (!bucket) return
    bucket.jobIds.delete(jobId)
    if (bucket.jobIds.size === 0) {
      this.reservations.delete(userId)
    }
    else {
      this.reservations.set(userId, bucket)
    }
  }

  async getSnapshot(userId: string): Promise<LandingAiQuotaSnapshot> {
    const limit = this.getLimit()
    const used = await this.countJobsForUser(userId)
    const reserved = this.getReservedCount(userId)
    const effectiveUsed = used + reserved
    const remaining = this.isUnlimited(limit)
      ? -1
      : Math.max(0, limit - effectiveUsed)

    return { used, reserved, limit, remaining }
  }

  async assertCanCreateAiJob(userId: string, jobId: string): Promise<void> {
    const limit = this.getLimit()
    if (this.isUnlimited(limit)) {
      this.reserveSlot(userId, jobId)
      return
    }

    const used = await this.countJobsForUser(userId)
    const reserved = this.getReservedCount(userId)

    if (used + reserved >= limit) {
      throw new HttpException(
        {
          upgrade: true,
          message: `Bạn đã dùng hết ${limit} lần tạo landing page bằng AI (${used}/${limit}).`,
          aiGenerations: { used, limit },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    this.reserveSlot(userId, jobId)
  }
}