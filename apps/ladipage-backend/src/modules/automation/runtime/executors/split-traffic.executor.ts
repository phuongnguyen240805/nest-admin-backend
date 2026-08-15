import { BadRequestException, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'

import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'
import type { FlowNodeExecutor } from '../flow-node-executor'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationSplitTrafficExecutor implements FlowNodeExecutor {
  readonly types = ['SPLIT_TRAFFIC', 'SPLITTRAFFIC'] as const

  async execute(step: RuntimeFlowStep, context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    const config = this.record(step.config)
    const details = this.record(config.details)
    const splitStep = this.record(this.array(details.steps ?? config.steps)[0])
    const cases = this.array(config.cases ?? details.cases ?? splitStep.cases)
      .map((item) => this.record(item))
      .map((item) => ({
        value: Number(item.value ?? item.weight ?? item.percentage ?? 0),
        nodeId: this.string(item.nodeId ?? item.nextStepId ?? item.targetNodeId),
      }))
      .filter((item) => Number.isFinite(item.value) && item.value >= 0)

    if (!cases.length) throw new BadRequestException('SPLIT_TRAFFIC requires cases')
    const total = cases.reduce((sum, item) => sum + item.value, 0)
    if (Math.abs(total - 100) > 0.001) throw new BadRequestException('SPLIT_TRAFFIC cases must total 100')

    const bucket = this.bucket(`${context.executionId}:${context.nodeId}`)
    let cursor = 0
    let selected = cases[cases.length - 1]
    for (const item of cases) {
      cursor += item.value
      if (bucket < cursor) {
        selected = item
        break
      }
    }

    const nextStepId = selected.nodeId || step.nextStepId || context.nextStepId || null
    return {
      kind: nextStepId ? 'CONTINUE' : 'COMPLETE',
      nextStepId,
      output: { splitBucket: bucket, splitWeight: selected.value, splitNodeId: selected.nodeId || null },
    }
  }

  private bucket(value: string): number {
    const hex = createHash('sha256').update(value).digest('hex').slice(0, 8)
    return parseInt(hex, 16) % 100
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }

  private string(value: unknown): string {
    return String(value ?? '').trim()
  }
}
