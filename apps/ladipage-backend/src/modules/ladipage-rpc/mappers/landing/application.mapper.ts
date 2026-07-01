import type { LpApplication } from '@liora/ladipage-types';

export function mapApplicationRpcItem(value: Record<string, unknown>): LpApplication {
  if ('_id' in value) return clone(value) as LpApplication;

  return {
    _id: stringValue(value.externalId),
    store_id: stringValue(value.storeId),
    owner_id: stringValue(value.ownerId),
    ladi_uid: stringValue(value.ladiUid),
    name: stringValue(value.name),
    code: stringValue(value.code),
    logo: nullableString(value.logo),
    thumb: nullableString(value.thumb),
    price: numberValue(value.price),
    status_active: booleanValue(value.statusActive),
    status_actived_at: dateValue(value.statusActivedAt),
    status_pin: booleanValue(value.statusPin),
    is_delete: booleanValue(value.isDelete),
    views_count: numberValue(value.viewsCount),
    installs_count: numberValue(value.installsCount),
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

function nullableString(value: unknown): string | null | undefined {
  return value == null ? null : String(value);
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function dateValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
