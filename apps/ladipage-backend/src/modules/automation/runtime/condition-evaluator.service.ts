import { Injectable } from '@nestjs/common'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationConditionEvaluatorService {
  evaluate(config: unknown, variables: JsonRecord, context: JsonRecord): boolean {
    const root = this.record(config)
    const conditions = Array.isArray(root.conditions)
      ? root.conditions.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      : [root].filter((item) => Object.keys(item).length > 0)
    if (!conditions.length) return true

    const operator = String(root.operator ?? 'AND').toUpperCase()
    const results = conditions.map((condition) => this.evaluateOne(condition, variables, context))
    return operator === 'OR' ? results.some(Boolean) : results.every(Boolean)
  }

  private evaluateOne(condition: JsonRecord, variables: JsonRecord, context: JsonRecord): boolean {
    const path = String(condition.field ?? condition.path ?? condition.key ?? '').trim()
    const operator = String(condition.operator ?? condition.op ?? 'eq').toLowerCase()
    const expected = condition.value
    const actual = path.startsWith('context.')
      ? this.get(context, path.slice('context.'.length))
      : path.startsWith('variables.')
        ? this.get(variables, path.slice('variables.'.length))
        : this.get({ ...context, ...variables }, path)

    switch (operator) {
      case 'eq':
      case 'equals':
        return this.scalar(actual) === this.scalar(expected)
      case 'neq':
      case 'not_equals':
        return this.scalar(actual) !== this.scalar(expected)
      case 'contains':
        return Array.isArray(actual)
          ? actual.some((item) => this.scalar(item) === this.scalar(expected))
          : String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
      case 'not_contains':
        return !this.evaluateOne({ ...condition, operator: 'contains' }, variables, context)
      case 'gt':
        return Number(actual) > Number(expected)
      case 'gte':
        return Number(actual) >= Number(expected)
      case 'lt':
        return Number(actual) < Number(expected)
      case 'lte':
        return Number(actual) <= Number(expected)
      case 'exists':
        return actual !== undefined && actual !== null && actual !== ''
      case 'not_exists':
        return actual === undefined || actual === null || actual === ''
      case 'in': {
        const values = Array.isArray(expected) ? expected : [expected]
        return values.some((item) => this.scalar(item) === this.scalar(actual))
      }
      case 'not_in': {
        const values = Array.isArray(expected) ? expected : [expected]
        return !values.some((item) => this.scalar(item) === this.scalar(actual))
      }
      default:
        return false
    }
  }

  private get(value: unknown, path: string): unknown {
    if (!path) return value
    let current: unknown = value
    for (const part of path.split('.').filter(Boolean)) {
      if (!current || typeof current !== 'object') return undefined
      current = (current as JsonRecord)[part]
    }
    return current
  }

  private scalar(value: unknown): string | number | boolean | null | undefined {
    if (typeof value === 'string') return value.trim().toLowerCase()
    if (value === null) return null
    if (value === undefined) return undefined
    if (typeof value === 'number' || typeof value === 'boolean') return value
    return JSON.stringify(value)
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }
}
