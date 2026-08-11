import { Injectable } from '@nestjs/common'

const SENSITIVE_KEY = /(authorization|api[-_]?key|secret|token|cookie|password|credential)/i

@Injectable()
export class ContextBudgetService {
  sanitize<T>(value: T, maxDepth = 8): T {
    return this.walk(value, 0, maxDepth) as T
  }

  trimMessages<T extends { content?: unknown }>(messages: T[], limit = 30): T[] {
    return messages
      .slice(Math.max(0, messages.length - Math.max(1, limit)))
      .map((message) => this.sanitize(message))
  }

  private walk(value: unknown, depth: number, maxDepth: number): unknown {
    if (depth > maxDepth) return '[truncated]'
    if (typeof value === 'string') {
      return value.length > 8_000 ? `${value.slice(0, 8_000)}…` : value
    }
    if (Array.isArray(value)) {
      return value.slice(0, 200).map((item) => this.walk(item, depth + 1, maxDepth))
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY.test(key)) continue
        out[key] = this.walk(item, depth + 1, maxDepth)
      }
      return out
    }
    return value
  }
}
