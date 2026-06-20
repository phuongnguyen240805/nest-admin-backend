/** Enterprise custom object quotas per subscription tier (Phase 8). */
export const CRM_ENTERPRISE_OBJECT_LIMITS: Record<string, number> = {
  free: 0,
  pro: 0,
  enterprise: 10,
  lifetime: -1,
}

export const CRM_ENTERPRISE_RECORD_LIMITS: Record<string, number> = {
  free: 0,
  pro: 0,
  enterprise: 10_000,
  lifetime: -1,
}

export function getEnterpriseObjectLimit(tier: string | undefined | null): number {
  const key = (tier ?? 'free').toLowerCase()
  return CRM_ENTERPRISE_OBJECT_LIMITS[key] ?? CRM_ENTERPRISE_OBJECT_LIMITS.free
}

export function getEnterpriseRecordLimit(tier: string | undefined | null): number {
  const key = (tier ?? 'free').toLowerCase()
  return CRM_ENTERPRISE_RECORD_LIMITS[key] ?? CRM_ENTERPRISE_RECORD_LIMITS.free
}

export function isEnterpriseTierAllowed(tier: string | undefined | null): boolean {
  return getEnterpriseObjectLimit(tier) !== 0
}