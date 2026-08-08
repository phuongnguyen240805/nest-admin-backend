export const ADS_PROVIDERS = ['META', 'TIKTOK', 'SHOPEE'] as const

export type AdsProvider = (typeof ADS_PROVIDERS)[number]

export const ADS_CAPABILITIES = [
  'CONNECTION',
  'ACCOUNT_DISCOVERY',
  'ASSET_SYNC',
  'PERFORMANCE_SYNC',
  'DRAFT_VALIDATION',
  'PUBLISH',
  'STATUS_ACTION',
  'BUDGET_ACTION',
  'WEBHOOK',
  'BROWSER_SNAPSHOT',
] as const

export type AdsCapability = (typeof ADS_CAPABILITIES)[number]

export type AdsCanonicalSource =
  | 'OFFICIAL_API'
  | 'PARTNER_API'
  | 'BROWSER_OBSERVED'

export interface AdsProviderManifest {
  provider: AdsProvider
  version: string
  canonicalSource: AdsCanonicalSource
  capabilities: readonly AdsCapability[]
}

export function hasAdsCapability(
  manifest: AdsProviderManifest,
  capability: AdsCapability,
): boolean {
  return manifest.capabilities.includes(capability)
}
