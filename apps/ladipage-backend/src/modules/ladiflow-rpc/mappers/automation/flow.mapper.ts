import type { LpFlow } from '@liora/ladipage-types';

export function mapAutomationFlowRpcItem(value: Record<string, unknown>): LpFlow {
  if ('_id' in value) return clone(value) as LpFlow;

  return {
    _id: stringValue(value.externalId),
    tags: arrayValue(value.tags),
    trigger_types: arrayValue(value.triggerTypes),
    integration_ids: arrayValue(value.integrationIds),
    scope_users: arrayValue(value.scopeUsers),
    scope_teams: arrayValue(value.scopeTeams),
    name: stringValue(value.name),
    alias: stringValue(value.alias),
    status: stringValue(value.status),
    store_id: stringValue(value.storeId),
    owner_id: stringValue(value.ownerId),
    is_delete: booleanValue(value.isDelete),
    is_sharing: booleanValue(value.isSharing),
    creator_id: stringValue(value.creatorId),
    type: nullableValue(value.type),
    sub_owner_id: stringValue(value.subOwnerId),
    scope_type: stringValue(value.scopeType),
    created_at: dateValue(value.createdAt),
    updated_at: dateValue(value.updatedAt),
    updated_last: dateValue(value.updatedLast),
    total_subscribe: numberValue(value.totalSubscribe),
    flow_config_count: numberValue(value.flowConfigCount),
  };
}

export function mapAutomationFlowShowRpcItem(value: Record<string, unknown>): Record<string, unknown> {
  if ('flow' in value) return clone(value) as Record<string, unknown>;

  const flow = mapAutomationFlowRpcItem(value) as Record<string, unknown>;
  const graph = value.graph && typeof value.graph === 'object'
    ? value.graph as Record<string, unknown>
    : {};

  return {
    flow: {
      ...graph,
      ...flow,
    },
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
