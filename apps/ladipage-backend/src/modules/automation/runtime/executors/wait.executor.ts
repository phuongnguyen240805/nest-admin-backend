import { BadRequestException, Injectable } from '@nestjs/common'

import type { FlowNodeExecutor } from '../flow-node-executor'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationWaitExecutor implements FlowNodeExecutor {
  readonly types = ['WAIT'] as const

  async execute(step: RuntimeFlowStep, _context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    const config = this.record(step.config)
    const message = this.record(config.message)
    const waitMs = this.resolveWaitMs(config, message)
    if (waitMs < 0) throw new BadRequestException('WAIT delay must be non-negative')
    if (waitMs === 0) return { kind: 'CONTINUE', nextStepId: step.nextStepId, output: { waitMs: 0 } }
    return { kind: 'WAIT', nextStepId: step.nextStepId, waitMs, output: { waitMs } }
  }

  private resolveWaitMs(config: JsonRecord, message: JsonRecord): number {
    const explicitMs = Number(config.delayMs ?? config.delay_ms ?? message.delayMs ?? message.delay_ms)
    if (Number.isFinite(explicitMs)) return Math.trunc(explicitMs)
    const seconds = Number(config.delaySeconds ?? config.delay_seconds ?? message.delaySeconds ?? message.delay_seconds)
    if (Number.isFinite(seconds)) return Math.trunc(seconds * 1000)
    const minutes = Number(config.delayMinutes ?? config.delay_minutes ?? message.delayMinutes ?? message.delay_minutes)
    if (Number.isFinite(minutes)) return Math.trunc(minutes * 60_000)
    const legacy = Number(message.delay_time ?? config.delay_time)
    if (Number.isFinite(legacy)) {
      const unit = String(process.env.AUTOMATION_LADIFLOW_DELAY_TIME_UNIT ?? 'seconds').toLowerCase()
      return Math.trunc(legacy * (unit === 'minutes' ? 60_000 : unit === 'milliseconds' ? 1 : 1000))
    }
    return 0
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }
}
