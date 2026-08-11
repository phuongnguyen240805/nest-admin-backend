import { Injectable } from '@nestjs/common'

type JobMode = 'reply' | 'analysis'
type AutomationOutcome = 'sent' | 'skipped' | 'failed' | 'superseded'

const MAX_LATENCY_SAMPLES = 500

@Injectable()
export class CustomerCareAiMetricsService {
  private readonly jobLatencies: number[] = []
  private readonly toolLatencies: number[] = []
  private jobsSuccess = 0
  private jobsFailed = 0
  private toolSuccess = 0
  private toolFailed = 0
  private readonly byMode: Record<JobMode, number> = { reply: 0, analysis: 0 }
  private readonly automation: Record<AutomationOutcome, number> = { sent: 0, skipped: 0, failed: 0, superseded: 0 }

  recordJob(input: { mode: JobMode; success: boolean; latencyMs: number }) {
    this.byMode[input.mode] += 1
    if (input.success) this.jobsSuccess += 1
    else this.jobsFailed += 1
    this.push(this.jobLatencies, input.latencyMs)
  }

  recordTool(input: { success: boolean; latencyMs: number }) {
    if (input.success) this.toolSuccess += 1
    else this.toolFailed += 1
    this.push(this.toolLatencies, input.latencyMs)
  }

  recordAutomation(outcome: AutomationOutcome) {
    this.automation[outcome] += 1
  }

  getSnapshot() {
    return {
      jobs: {
        total: this.jobsSuccess + this.jobsFailed,
        success: this.jobsSuccess,
        failed: this.jobsFailed,
        byMode: { ...this.byMode },
        p50LatencyMs: percentile(this.jobLatencies, 0.5),
        p95LatencyMs: percentile(this.jobLatencies, 0.95),
      },
      tools: {
        total: this.toolSuccess + this.toolFailed,
        success: this.toolSuccess,
        failed: this.toolFailed,
        p50LatencyMs: percentile(this.toolLatencies, 0.5),
        p95LatencyMs: percentile(this.toolLatencies, 0.95),
      },
      automation: { ...this.automation },
      generatedAt: new Date().toISOString(),
      note: 'Process-local operational metrics; use centralized telemetry for multi-instance aggregation.',
    }
  }

  private push(target: number[], value: number) {
    target.push(Math.max(0, Math.round(value)))
    if (target.length > MAX_LATENCY_SAMPLES) target.shift()
  }
}

function percentile(values: number[], p: number) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[index] ?? null
}
