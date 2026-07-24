export type CommerceConfig = {
  enabled: boolean
  /** When true, use in-process catalog — products will NOT appear in Medusa Admin */
  mockMode: boolean
  monetize: boolean
  medusaBaseUrl: string
  adminApiKey: string
  publishableKey: string
  defaultRegionId: string
  defaultCurrency: string
  timeoutMs: number
}

/**
 * mockMode rules:
 * - COMMERCE_MEDUSA_MOCK=false + MEDUSA_ADMIN_API_KEY → live
 * - COMMERCE_MEDUSA_MOCK=true → mock (even if key set)
 * - MOCK unset + key set → live (auto)
 * - MOCK unset + no key → mock
 */
export function getCommerceConfig(): CommerceConfig {
  const enabled = (process.env.COMMERCE_MEDUSA_ENABLED ?? 'true').toLowerCase() !== 'false'
  const monetize = (process.env.COMMERCE_MEDUSA_MONETIZE ?? 'false').toLowerCase() === 'true'
  const medusaBaseUrl = (
    process.env.MEDUSA_BACKEND_URL
    ?? process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
    ?? 'http://localhost:9000'
  ).replace(/\/$/, '')
  const adminApiKey = (process.env.MEDUSA_ADMIN_API_KEY ?? '').trim()
  const publishableKey = (
    process.env.MEDUSA_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    ?? ''
  ).trim()

  const mockEnv = process.env.COMMERCE_MEDUSA_MOCK
  let mockMode: boolean
  if (mockEnv !== undefined && mockEnv !== '') {
    mockMode = mockEnv.toLowerCase() !== 'false'
  }
  else {
    // Auto: live when admin key present
    mockMode = !adminApiKey
  }

  return {
    enabled,
    mockMode,
    monetize,
    medusaBaseUrl,
    adminApiKey,
    publishableKey,
    defaultRegionId: process.env.MEDUSA_DEFAULT_REGION_ID ?? 'reg_01_vn',
    defaultCurrency: (process.env.MEDUSA_DEFAULT_CURRENCY ?? 'vnd').toLowerCase(),
    timeoutMs: Number(process.env.MEDUSA_TIMEOUT_MS ?? 15_000),
  }
}
