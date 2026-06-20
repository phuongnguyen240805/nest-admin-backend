/** CRM custom field limits per subscription tier (Phase 7). */
export const CRM_CUSTOM_FIELD_LIMITS: Record<string, number> = {
  free: 0,
  pro: 20,
  enterprise: -1,
  lifetime: -1,
}

export function getCustomFieldLimit(tier: string | undefined | null): number {
  const key = (tier ?? 'free').toLowerCase()
  return CRM_CUSTOM_FIELD_LIMITS[key] ?? CRM_CUSTOM_FIELD_LIMITS.free
}

export function isCustomFieldTierAllowed(tier: string | undefined | null): boolean {
  return getCustomFieldLimit(tier) !== 0
}