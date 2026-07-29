export type CloudPhoneConfig = {
  /** Feature master switch (app can be listed but disabled). */
  enabled: boolean
  /**
   * When true, device/booking/session data is served from an in-process
   * mock — GADS is NOT contacted. Mirrors the commerce mock-mode seam so the
   * UI can be built and verified before GADS wiring lands.
   */
  mockMode: boolean
  /** GADS Hub base URL (used only when mockMode=false). */
  gadsHubUrl: string
  gadsClientId: string
  gadsClientSecret: string
  /** API lock lease TTL in minutes. */
  leaseTtlMin: number
  /** Auto-release a session after this many idle minutes. */
  sessionIdleMin: number
}

/**
 * mockMode rules (mirrors commerce.config):
 * - CLOUDPHONE_GADS_MOCK=false + GADS_CLIENT_SECRET → live
 * - CLOUDPHONE_GADS_MOCK=true → mock (even if creds set)
 * - MOCK unset + creds set → live (auto)
 * - MOCK unset + no creds → mock
 */
export function getCloudPhoneConfig(): CloudPhoneConfig {
  const enabled = (process.env.CLOUDPHONE_ENABLED ?? 'true').toLowerCase() !== 'false'
  const gadsHubUrl = (process.env.GADS_HUB_URL ?? 'http://localhost:10000').replace(/\/$/, '')
  const gadsClientId = (process.env.GADS_CLIENT_ID ?? '').trim()
  const gadsClientSecret = (process.env.GADS_CLIENT_SECRET ?? '').trim()

  const mockEnv = process.env.CLOUDPHONE_GADS_MOCK
  let mockMode: boolean
  if (mockEnv !== undefined && mockEnv !== '') {
    mockMode = mockEnv.toLowerCase() !== 'false'
  }
  else {
    mockMode = !gadsClientSecret
  }

  return {
    enabled,
    mockMode,
    gadsHubUrl,
    gadsClientId,
    gadsClientSecret,
    leaseTtlMin: Number(process.env.CLOUDPHONE_LEASE_TTL_MIN ?? 10),
    sessionIdleMin: Number(process.env.CLOUDPHONE_SESSION_IDLE_MIN ?? 30),
  }
}
