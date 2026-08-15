import { Injectable } from '@nestjs/common'

import type { RuntimeFlowGraph, RuntimeFlowStep, RuntimeGraphSchema } from '../runtime/automation-runtime.types'

@Injectable()
export class LadiflowGraphAdapterService {
  adapt(value: unknown): RuntimeFlowGraph {
    const raw = this.record(value)
    const schema = this.detectSchema(raw)

    if (schema === 'node-graph') return this.adaptNodeGraph(raw)
    if (schema === 'ladiflow') return this.adaptLadiflow(raw)
    return { schema, triggers: [], steps: [], raw }
  }

  detectSchema(raw: Record<string, unknown>): RuntimeGraphSchema {
    if (Array.isArray(raw.flowConfigs) || Array.isArray(raw.triggers)) return 'ladiflow'
    if (Array.isArray(raw.nodes)) return 'node-graph'
    return 'unknown'
  }

  private adaptNodeGraph(raw: Record<string, unknown>): RuntimeFlowGraph {
    const nodes = this.records(raw.nodes)
    const edges = this.records(raw.edges)
    const edgeMap = new Map<string, Array<{ target: string; handle: string }>>()

    for (const edge of edges) {
      const source = String(edge.source ?? edge.sourceId ?? '').trim()
      const target = String(edge.target ?? edge.targetId ?? '').trim()
      if (!source || !target) continue
      const handle = String(edge.sourceHandle ?? edge.handle ?? '').toLowerCase()
      const rows = edgeMap.get(source) ?? []
      rows.push({ target, handle })
      edgeMap.set(source, rows)
    }

    const steps = nodes.map((node, index) => {
      const step = this.nodeGraphStep(node, index)
      const outgoing = edgeMap.get(step.id) ?? []
      const explicitNext = this.firstString(
        step.config.nextStepId,
        step.config.next_step_id,
        node.nextStepId,
        node.next_step_id,
      )
      step.nextStepId = explicitNext || outgoing[0]?.target
      step.trueStepId = this.firstString(
        step.config.trueStepId,
        step.config.true_step_id,
        step.config.onTrue,
        step.config.on_true,
        outgoing.find((item) => /true|yes|success|match/.test(item.handle))?.target,
      )
      step.falseStepId = this.firstString(
        step.config.falseStepId,
        step.config.false_step_id,
        step.config.onFalse,
        step.config.on_false,
        outgoing.find((item) => /false|no|failure|else/.test(item.handle))?.target,
      )
      return step
    })

    const explicitStart = this.firstString(raw.startStepId, raw.start_step_id, raw.startNodeId, raw.start_node_id)
    const markedStart = nodes.find((node) => this.record(node.data).isStartNode === true)
    const markedStartId = markedStart ? this.idOf(markedStart, '') : undefined
    return {
      schema: 'node-graph',
      triggers: this.records(raw.triggers),
      steps,
      startStepId: explicitStart || markedStartId || steps[0]?.id,
      raw,
    }
  }

  private adaptLadiflow(raw: Record<string, unknown>): RuntimeFlowGraph {
    const flowConfigs = this.records(raw.flowConfigs)
    const firstStepByCode = new Map<string, string>()
    const buckets: Array<{ config: Record<string, unknown>; steps: RuntimeFlowStep[] }> = []

    for (const [configIndex, config] of flowConfigs.entries()) {
      const messages = this.records(config.messages)
      const steps = messages.map((message, messageIndex) => ({
        id: this.idOf(message, `${this.idOf(config, `flow-config-${configIndex}`)}:${messageIndex}`),
        type: this.nodeType(message.type ?? config.type ?? 'UNKNOWN'),
        order: this.numberOf(config.ordering, configIndex) * 1000 + messageIndex,
        config: { flowConfig: config, message },
        source: message,
      } satisfies RuntimeFlowStep))
      const code = String(config.code ?? '').trim()
      if (code && steps[0]) firstStepByCode.set(code, steps[0].id)
      buckets.push({ config, steps })
    }

    const allSteps = buckets.flatMap((bucket) => bucket.steps).sort((a, b) => a.order - b.order)
    for (const [index, step] of allSteps.entries()) {
      step.nextStepId = allSteps[index + 1]?.id
      const message = this.record(step.config.message)
      if (step.type === 'NEXT_STEP') {
        const code = String(message.next_step_code ?? message.nextStepCode ?? '').trim()
        if (code) step.nextStepId = firstStepByCode.get(code)
      }
    }

    return {
      schema: 'ladiflow',
      triggers: this.records(raw.triggers),
      steps: allSteps,
      startStepId: allSteps[0]?.id,
      raw,
    }
  }

  private nodeGraphStep(node: Record<string, unknown>, index: number): RuntimeFlowStep {
    const data = this.record(node.data)
    return {
      id: this.idOf(node, `node-${index}`),
      type: this.nodeType(node.type ?? data.type ?? 'UNKNOWN'),
      order: index,
      config: data,
      source: node,
    }
  }

  private nodeType(value: unknown): string {
    return String(value ?? 'UNKNOWN')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase() || 'UNKNOWN'
  }

  private firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
      const text = String(value ?? '').trim()
      if (text) return text
    }
    return undefined
  }

  private idOf(value: Record<string, unknown>, fallback: string): string {
    return String(value._id ?? value.id ?? fallback)
  }

  private numberOf(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
  }

  private records(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      : []
  }
}
