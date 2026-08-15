import { Injectable } from '@nestjs/common'

import { LadiflowGraphAdapterService } from './ladiflow-graph-adapter.service'
import type { FlowGraphValidationResult } from '../runtime/automation-runtime.types'

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

    this.validateUniqueStepIds(runtime.steps.map((step) => step.id), errors)

    if (runtime.schema === 'ladiflow') {
      const flowConfigs = Array.isArray(runtime.raw.flowConfigs) ? runtime.raw.flowConfigs : []
      if (flowConfigs.length === 0) warnings.push('Flow has no flowConfigs; publishing it will not execute any action yet.')
      const triggerIds = runtime.triggers.map((trigger, index) => String(trigger._id ?? trigger.id ?? `trigger-${index}`))
      this.validateUniqueIds(triggerIds, 'trigger', errors)
    }

    if (runtime.schema === 'node-graph' && runtime.steps.length === 0) {
      errors.push('Node graph contains no nodes.')
    }

    return { valid: errors.length === 0, schema: runtime.schema, errors, warnings }
  }

  private validateUniqueStepIds(ids: string[], errors: string[]) {
    this.validateUniqueIds(ids, 'step', errors)
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
