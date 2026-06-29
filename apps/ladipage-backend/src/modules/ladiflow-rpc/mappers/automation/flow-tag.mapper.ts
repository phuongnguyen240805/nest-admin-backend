import type { LpFlowTag } from '@liora/ladipage-types'

export function mapAutomationFlowTagRpcItem(value: Record<string, unknown>): LpFlowTag {
  if ('_id' in value) return clone(value) as LpFlowTag

  return {
    _id: stringValue(value.externalId),
    store_id: stringValue(value.storeId),
    creator_id: stringValue(value.creatorId),
    owner_id: stringValue(value.ownerId),
    name: stringValue(value.name),
    alias: stringValue(value.alias),
    total: numberValue(value.total),
    is_delete: booleanValue(value.isDelete),
    status: booleanValue(value.status),
    created_at: dateValue(value.createdAt),
    updated_at: dateValue(value.updatedAt),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function stringValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value)
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function dateValue(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  return String(value)
}
