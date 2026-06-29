import type { LpDomain, LpPage } from '@liora/ladipage-types';

export function mapLandingPageRpcItem(value: Record<string, unknown>): LpPage {
  if ('_id' in value) return clone(value) as LpPage;

  const tracking = objectValue(value.tracking);
  const revenue = objectValue(value.revenue);
  return {
    _id: stringValue(value.externalId),
    scope_teams: arrayValue(value.scopeTeams),
    scope_users: arrayValue(value.scopeUsers),
    tags: arrayValue(value.tags),
    tag_ai: arrayValue(value.tagAi),
    content_versions: arrayValue(value.contentVersions),
    store_id: stringValue(value.storeId),
    owner_id: stringValue(value.ownerId),
    creator_id: stringValue(value.creatorId),
    name: stringValue(value.name),
    alias: stringValue(value.alias),
    domain: nullableValue(value.domain),
    path: nullableValue(value.path),
    https: booleanValue(value.https),
    page_url: nullableValue(value.pageUrl),
    url: nullableValue(value.url),
    backup_count: numberValue(value.backupCount),
    publish_platform: nullableString(value.publishPlatform),
    last_update_source: dateValue(value.lastUpdateSource),
    last_update_source_mobile: dateValue(value.lastUpdateSourceMobile),
    design_type: stringValue(value.designType),
    is_publish: booleanValue(value.isPublish),
    tracking: {
      total_visit: numberValue(tracking.total_visit ?? value.trackingTotalVisit) ?? 0,
      total_unique_visit: numberValue(tracking.total_unique_visit ?? value.trackingTotalUniqueVisit) ?? 0,
      total_conversion: numberValue(tracking.total_conversion ?? value.trackingTotalConversion) ?? 0,
      total_unique_conversion: numberValue(tracking.total_unique_conversion ?? value.trackingTotalUniqueConversion) ?? 0,
      cr: numberValue(tracking.cr ?? value.trackingCr) ?? 0,
      last_updated_at: dateValue(tracking.last_updated_at ?? value.trackingLastUpdatedAt) ?? null,
    },
    revenue: {
      total: numberValue(revenue.total ?? value.revenueTotal) ?? 0,
      currency: stringValue(revenue.currency ?? value.revenueCurrency) ?? 'VND',
    },
    traking_data: stringValue(value.trakingData),
    type: stringValue(value.type),
    is_delete: booleanValue(value.isDelete),
    origin_id: stringValue(value.originId),
    user_scopes: arrayValue(value.userScopes),
    form_inputs: arrayValue(value.formInputs),
    created_at: dateValue(value.createdAt),
    updated_at: dateValue(value.updatedAt),
    subdomain: stringValue(value.subdomain),
  };
}

export function mapLandingPageShowRpcItem(value: Record<string, unknown>): Record<string, unknown> {
  if ('ladipage' in value) return clone(value) as Record<string, unknown>;

  const page = mapLandingPageRpcItem(value) as Record<string, unknown>;
  const source = value.source && typeof value.source === 'object'
    ? JSON.stringify(value.source)
    : stringValue(value.source) ?? '{}';

  return {
    source,
    ladipage: page,
  };
}

export function mapLandingDomainRpcItem(value: Record<string, unknown>): LpDomain {
  if ('_id' in value) return clone(value) as LpDomain;

  return {
    _id: stringValue(value.externalId),
    domain: stringValue(value.domain),
    is_subdomain: booleanValue(value.isSubdomain),
    subdomain_default: stringValue(value.subdomainDefault),
    status: booleanValue(value.status),
    is_preview: booleanValue(value.isPreview),
    is_ssl: booleanValue(value.isSsl),
    publish_platform: stringValue(value.publishPlatform),
    is_verified: booleanValue(value.isVerified),
    is_delete: booleanValue(value.isDelete),
    is_default: booleanValue(value.isDefault),
    is_hidden: booleanValue(value.isHidden),
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
