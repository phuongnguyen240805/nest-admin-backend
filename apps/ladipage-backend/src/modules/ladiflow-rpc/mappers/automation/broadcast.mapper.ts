import type { LpBroadcast } from '@liora/ladipage-types'

export function mapAutomationBroadcastRpcItem(value: Record<string, unknown>): LpBroadcast {
  if ('_id' in value) return clone(value) as LpBroadcast

  return {
    _id: stringValue(value.externalId),
    segments: arrayValue(value.segments),
    tags: arrayValue(value.tags),
    scope_users: arrayValue(value.scopeUsers),
    scope_teams: arrayValue(value.scopeTeams),
    name: stringValue(value.name),
    alias: stringValue(value.alias),
    store_id: stringValue(value.storeId),
    type: stringValue(value.type),
    owner_id: stringValue(value.ownerId),
    creator_id: stringValue(value.creatorId),
    sub_owner_id: stringValue(value.subOwnerId),
    is_delete: booleanValue(value.isDelete),
    status: stringValue(value.status),
    version: stringValue(value.version),
    scope_type: stringValue(value.scopeType),
    conditions: arrayValue(value.conditions),
    created_at: dateValue(value.createdAt),
    updated_at: dateValue(value.updatedAt),
    flow_id: stringValue(value.flowId),
    config_type: nullableValue(value.configType),
    email: objectValue(value.email) as never,
    'email.integration_id': stringValue(objectValue(value.email).integration_id),
    messenger: objectValue(value.messenger) as never,
    operator: nullableValue(value.operator),
    send_limit_option: nullableValue(value.sendLimitOption),
    sent_date: dateValue(value.sentDate),
    sms: objectValue(value.sms) as never,
    start_date: dateValue(value.startDate) ?? null,
    zalo: objectValue(value.zalo) as never,
    'zalo.message_template_configs': arrayValue(objectValue(value.zalo).message_template_configs),
    total_click: numberValue(value.totalClick),
    total_delivery: numberValue(value.totalDelivery),
    total_read: numberValue(value.totalRead),
    total_send: numberValue(value.totalSend),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function stringValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value)
}

function nullableValue(value: unknown): unknown | null {
  return value == null ? null : value
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function dateValue(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString()
  return String(value)
}
