import { Injectable } from '@nestjs/common'

interface MetricCounter {
  count: number
  totalLatencyMs: number
  maxLatencyMs: number
}

@Injectable()
export class AutomationMetricsService {
  private readonly counters = new Map<number, Map<string, MetricCounter>>()

  recordTrigger(tenantId: number, outcome: 'started' | 'resumed' | 'matched-zero'): void {
    this.bump(tenantId, `trigger.${outcome}`)
  }

  recordFlow(tenantId: number, outcome: 'completed' | 'failed'): void {
    this.bump(tenantId, `flow.${outcome}`)
  }

  recordOutbound(tenantId: number, outcome: 'sent' | 'dead' | 'retry' | 'cancelled', latencyMs = 0): void {
    this.bump(tenantId, `outbound.${outcome}`, latencyMs)
  }

  recordAction(tenantId: number, outcome: 'completed' | 'dead' | 'retry' | 'cancelled', latencyMs = 0): void {
    this.bump(tenantId, `action.${outcome}`, latencyMs)
  }

  snapshot(tenantId: number): Record<string, unknown> {
    const counters = this.counters.get(tenantId) ?? new Map<string, MetricCounter>()
    return {
      tenantId,
      scope: 'process-local-tenant',
      generatedAt: new Date().toISOString(),
      counters: Object.fromEntries(
        [...counters.entries()].map(([name, value]) => [name, {
          count: value.count,
          avgLatencyMs: value.count ? Math.round(value.totalLatencyMs / value.count) : 0,
          maxLatencyMs: value.maxLatencyMs,
        }]),
      ),
    }
  }

  private bump(tenantId: number, name: string, latencyMs = 0): void {
    if (!Number.isInteger(tenantId) || tenantId <= 0) return
    const tenantCounters = this.counters.get(tenantId) ?? new Map<string, MetricCounter>()
    const current = tenantCounters.get(name) ?? { count: 0, totalLatencyMs: 0, maxLatencyMs: 0 }
    const safeLatency = Number.isFinite(latencyMs) ? Math.max(0, Math.trunc(latencyMs)) : 0
    current.count += 1
    current.totalLatencyMs += safeLatency
    current.maxLatencyMs = Math.max(current.maxLatencyMs, safeLatency)
    tenantCounters.set(name, current)
    this.counters.set(tenantId, tenantCounters)
  }
}
