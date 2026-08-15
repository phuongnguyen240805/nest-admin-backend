import { BadRequestException, Injectable } from '@nestjs/common'

import type { FlowNodeExecutor } from '../flow-node-executor'
import type { FlowNodeExecutionContext, FlowNodeExecutionResult, RuntimeFlowStep } from '../automation-runtime.types'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationSetVariableExecutor implements FlowNodeExecutor {
  readonly types = ['SET_VARIABLE'] as const

  async execute(step: RuntimeFlowStep, context: FlowNodeExecutionContext): Promise<FlowNodeExecutionResult> {
    const config = this.record(step.config)
    const key = String(config.key ?? config.name ?? config.variable ?? '').trim()
    if (!key) throw new BadRequestException('SET_VARIABLE requires key')
    const value = config.fromPath ? this.get({ context: context.context, variables: context.variables }, String(config.fromPath)) : config.value
    this.set(context.variables, key, value)
    return { kind: 'CONTINUE', nextStepId: step.nextStepId, output: { key, value } }
  }

  private set(target: JsonRecord, path: string, value: unknown) {
    const parts = path.split('.').filter(Boolean)
    if (!parts.length) return
    let current = target
    for (const part of parts.slice(0, -1)) {
      const next = current[part]
      current[part] = next && typeof next === 'object' && !Array.isArray(next) ? next : {}
      current = current[part] as JsonRecord
    }
    current[parts[parts.length - 1]] = value
  }

  private get(value: unknown, path: string): unknown {
    let current: unknown = value
    for (const part of path.split('.').filter(Boolean)) {
      if (!current || typeof current !== 'object') return undefined
      current = (current as JsonRecord)[part]
    }
    return current
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }
}
