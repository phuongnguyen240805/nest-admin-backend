import type { LpCrmPipeline } from '@liora/ladipage-types';

export function mapLadiworkPipelineRpcItem(value: Record<string, unknown>): LpCrmPipeline {
  if ('_id' in value) return clone(value) as LpCrmPipeline;

  return {
    _id: stringValue(value.externalId),
    deal_probability: booleanValue(value.dealProbability),
    scope_users: arrayValue(value.scopeUsers),
    scope_object_users: arrayValue(value.scopeObjectUsers),
    scope_teams: arrayValue(value.scopeTeams),
    is_delete: booleanValue(value.isDelete),
    privacy_mode: booleanValue(value.privacyMode),
    prioritize_ladiuid: arrayValue(value.prioritizeLadiuid),
    name: stringValue(value.name),
    alias: stringValue(value.alias),
    store_id: stringValue(value.storeId),
    type: stringValue(value.type),
    creator_id: stringValue(value.creatorId),
    owner_id: stringValue(value.ownerId),
    scope_type: stringValue(value.scopeType),
    pipeline_category_id: nullableValue(value.pipelineCategoryId),
    category_id: nullableValue(value.categoryId),
    notification: booleanValue(value.notification),
    timer_notification: nullableValue(value.timerNotification),
    unit_notification: stringValue(value.unitNotification),
    avatar: nullableValue(value.avatar),
    count: numberValue(value.count),
    created_at: dateValue(value.createdAt),
    updated_at: dateValue(value.updatedAt),
    next_time_check_notification_deal_delayer: dateValue(value.nextTimeCheckNotificationDealDelayer),
    stages: arrayValue(value.stages),
    custom_fields: arrayValue(value.customFields),
    pipelines: arrayValue(value.pipelines),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function stringValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function nullableValue(value: unknown): unknown | null {
  return value == null ? null : value;
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function dateValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
