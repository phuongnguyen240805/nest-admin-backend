import { Injectable } from '@nestjs/common'

import { LadiflowGraphAdapterService } from './ladiflow-graph-adapter.service'
import type { FlowGraphValidationResult } from '../runtime/automation-runtime.types'

const SUPPORTED_RUNTIME_TYPES = new Set([
  'START',
  'TEXT',
  'SEND_MESSAGE',
  'CONDITION',
  'SET_VARIABLE',
  'WAIT',
  'WAIT_FOR_REPLY',
  'NEXT_STEP',
  'END',
])

@Injectable()
export class LadiflowGraphValidatorService {
  constructor(private readonly adapter: LadiflowGraphAdapterService) {}

  validate(value: unknown): FlowGraphValidationResult {
    const runtime = this.adapter.adapt(value)
    const errors: string[] = []
    const warnings: string[] = []

    if (runtime.schema === 'unknown') {
      errors.push('Flow graph must contain LadiFlow flowConfigs/triggers or a nodes array.')
      return { valid: false, schema: runtime.schema, errors, warnings }
    }

    this.validateUniqueIds(runtime.steps.map((step) => step.id), 'step', errors)
    const ids = new Set(runtime.steps.map((step) => step.id))
    if (runtime.steps.length && !runtime.startStepId) errors.push('Flow has no start step.')
    if (runtime.startStepId && !ids.has(runtime.startStepId)) errors.push(`Start step does not exist: ${runtime.startStepId}`)

    for (const step of runtime.steps) {
      for (const [label, target] of [
        ['next', step.nextStepId],
        ['true', step.trueStepId],
        ['false', step.falseStepId],
      ] as const) {
        if (target && !ids.has(target)) errors.push(`${step.id} references missing ${label} step: ${target}`)
      }
      if (!SUPPORTED_RUNTIME_TYPES.has(step.type)) {
        warnings.push(`Runtime does not execute node type ${step.type} yet; an execution reaching it will fail safely.`)
      }
    }

    if (runtime.schema === 'ladiflow') {
      const flowConfigs = Array.isArray(runtime.raw.flowConfigs) ? runtime.raw.flowConfigs : []
      if (flowConfigs.length === 0) warnings.push('Flow has no flowConfigs; publishing it will not execute any action yet.')
      const triggerIds = runtime.triggers.map((trigger, index) => String(trigger._id ?? trigger.id ?? `trigger-${index}`))
      this.validateUniqueIds(triggerIds, 'trigger', errors)
    }

    if (runtime.schema === 'node-graph' && runtime.steps.length === 0) errors.push('Node graph contains no nodes.')

    return { valid: errors.length === 0, schema: runtime.schema, errors, warnings }
  }

  private validateUniqueIds(ids: string[], label: string, errors: string[]) {
    const seen = new Set<string>()
    for (const id of ids) {
      if (!id.trim()) {
        errors.push(`${label} id must not be empty.`)
        continue
      }
      if (seen.has(id)) errors.push(`Duplicate ${label} id: ${id}`)
      seen.add(id)
    }
  }
}
