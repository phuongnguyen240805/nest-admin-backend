import type { LpIntegration } from '@liora/ladipage-types';

export function mapAutomationIntegrationRpcItem(value: Record<string, unknown>): LpIntegration {
  if ('_id' in value) return clone(value) as LpIntegration;

  const config = objectValue(value.config);
  return {
    _id: stringValue(value.externalId),
    scope_users: arrayValue(value.scopeUsers),
    scope_teams: arrayValue(value.scopeTeams),
    name: stringValue(value.name),
    alias: stringValue(value.alias),
    type: stringValue(value.type),
    store_id: stringValue(value.storeId),
    owner_id: stringValue(value.ownerId),
    creator_id: stringValue(value.creatorId),
    is_delete: booleanValue(value.isDelete),
    status: booleanValue(value.status),
    config: config as never,
    'config._id': stringValue(config._id ?? value.configId),
    'config.api_key': stringValue(config.api_key ?? value.configApiKey),
    'config.refresh_token': stringValue(config.refresh_token ?? value.configRefreshToken),
    is_default: booleanValue(value.isDefault),
    scope_type: stringValue(value.scopeType),
    attachments: arrayValue(value.attachments),
    created_at: dateValue(value.createdAt),
    updated_at: dateValue(value.updatedAt),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function stringValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function dateValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
