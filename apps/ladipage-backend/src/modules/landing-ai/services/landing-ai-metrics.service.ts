import { Injectable } from '@nestjs/common'

export type LandingAiJobMetricRecord = {
  jobId: string
  pageId: string
  type: string
  tenantId: number
  success: boolean
  totalDurationMs: number
  s2cDurationMs?: number
  screenshotDurationMs?: number
  mock?: boolean
  recordedAt: string
}

export type LandingAiMetricsSnapshot = {
  totalJobs: number
  successCount: number
  failureCount: number
  successRate: number
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  recentJobs: LandingAiJobMetricRecord[]
}

const MAX_SAMPLES = 500

@Injectable()
export class LandingAiMetricsService {
  private readonly samples: number[] = []
  private readonly recentJobs: LandingAiJobMetricRecord[] = []
  private successCount = 0
  private failureCount = 0

  recordJob(record: Omit<LandingAiJobMetricRecord, 'recordedAt'>): void {
    if (record.success) {
      this.successCount += 1
    }
    else {
      this.failureCount += 1
    }

    this.samples.push(record.totalDurationMs)
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.shift()
    }

    this.recentJobs.unshift({
      ...record,
      recordedAt: new Date().toISOString(),
    })
    if (this.recentJobs.length > 50) {
      this.recentJobs.pop()
    }
  }

  getSnapshot(): LandingAiMetricsSnapshot {
    const totalJobs = this.successCount + this.failureCount
    const sorted = [...this.samples].sort((a, b) => a - b)

    return {
      totalJobs,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: totalJobs === 0 ? 0 : this.successCount / totalJobs,
      p50LatencyMs: percentile(sorted, 0.5),
      p95LatencyMs: percentile(sorted, 0.95),
      recentJobs: [...this.recentJobs],
    }
  }
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  )
  return sorted[index] ?? null
}