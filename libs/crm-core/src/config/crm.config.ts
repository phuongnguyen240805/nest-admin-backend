/** CRM feature flag — default false keeps lp_* path. */
export function isCrmEnabled(): boolean {
  const raw =
    process.env.CRM_ENABLED ?? process.env.CRM_V2_ENABLED ?? 'false'
  return raw === 'true' || raw === '1'
}