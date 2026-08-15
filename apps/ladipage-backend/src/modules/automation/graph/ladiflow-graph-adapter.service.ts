import { Injectable } from '@nestjs/common'

import type { RuntimeFlowGraph, RuntimeFlowStep, RuntimeGraphSchema } from '../runtime/automation-runtime.types'

@Injectable()
export class LadiflowGraphAdapterService {
  adapt(value: unknown): RuntimeFlowGraph {
    const raw = this.record(value)
    const schema = this.detectSchema(raw)

    if (schema === 'node-graph') {
      return {
        schema,
        triggers: this.records(raw.triggers),
        steps: this.records(raw.nodes).map((node, index) => this.nodeGraphStep(node, index)),
        raw,
      }
    }

    if (schema === 'ladiflow') {
      const flowConfigs = this.records(raw.flowConfigs)
      const steps: RuntimeFlowStep[] = []
      for (const [configIndex, config] of flowConfigs.entries()) {
        const messages = this.records(config.messages)
        for (const [messageIndex, message] of messages.entries()) {
          steps.push({
            id: this.idOf(message, `${this.idOf(config, `flow-config-${configIndex}`)}:${messageIndex}`),
            type: String(message.type ?? config.type ?? 'UNKNOWN').toUpperCase(),
            order: this.numberOf(config.ordering, configIndex) * 1000 + messageIndex,
            config: { flowConfig: config, message },
            source: message,
          })
        }
      }
      return {
        schema,
        triggers: this.records(raw.triggers),
        steps,
        raw,
      }
    }

    return { schema, triggers: [], steps: [], raw }
  }

  detectSchema(raw: Record<string, unknown>): RuntimeGraphSchema {
    if (Array.isArray(raw.flowConfigs) || Array.isArray(raw.triggers)) return 'ladiflow'
    if (Array.isArray(raw.nodes)) return 'node-graph'
    return 'unknown'
  }

  private nodeGraphStep(node: Record<string, unknown>, index: number): RuntimeFlowStep {
    const data = this.record(node.data)
    return {
      id: this.idOf(node, `node-${index}`),
      type: String(node.type ?? data.type ?? 'UNKNOWN'),
      order: index,
      config: data,
      source: node,
    }
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
