import { ConfigType, registerAs } from '@nestjs/config'

export const landingCmsRegToken = 'landingCms'

function env(key: string, defaultValue = ''): string {
  const raw = process.env[key]
  if (raw == null) return defaultValue
  return String(raw).trim()
}

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key]
  if (raw == null || String(raw).trim() === '') return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase())
}

/**
 * Instatic CMS connection + bridge secrets.
 * All secrets stay server-side (Nest only).
 *
 * Docker Nest: do NOT use http://127.0.0.1:8787 (that is the container loopback).
 * Use http://host.docker.internal:8787 when Instatic runs on the host.
 */
export const LandingCmsConfig = registerAs(landingCmsRegToken, () => {
  const baseUrl = env('INSTATIC_BASE_URL', 'http://127.0.0.1:8787').replace(/\/$/, '')
  return {
    /** When true, adapter returns deterministic mock responses (tests / no CMS). */
    mock: envBool('INSTATIC_MOCK', envBool('LANDING_CMS_MOCK', true)),
    baseUrl,
    adminToken: env('INSTATIC_ADMIN_TOKEN', ''),
    ssoSecret: env('INSTATIC_SSO_SECRET', 'dev-instatic-sso-secret-change-me'),
    bridgeHmacSecret: env('LADIPAGE_BRIDGE_HMAC_SECRET', 'dev-bridge-hmac-secret-change-me'),
    /** Public path prefix on Ladipage origin that proxies to Instatic. */
    publicCmsPrefix: env('INSTATIC_PUBLIC_PREFIX', '/_cms'),
    /**
     * Browser-facing Instatic origin (Vite dev or public CMS).
     * SSO redirect target base. Dev default: http://127.0.0.1:5174
     */
    /**
     * Browser origin customers open for the editor (MUST be Ladipage host in product).
     * Same-origin: http://localhost:3000 → /admin/... rewritten by Next to Instatic.
     * Never point this at :5174 in product UX (port change confuses customers).
     */
    publicEditorOrigin: env(
      'INSTATIC_PUBLIC_EDITOR_ORIGIN',
      env('NEXT_PUBLIC_APP_URL', env('NEXT_PUBLIC_INSTATIC_EDITOR_ORIGIN', 'http://localhost:3000')),
    ),
    sessionTtlSeconds: Number(env('INSTATIC_SESSION_TTL_SECONDS', '3600')) || 3600,
    /** Publish source switch: instatic-artifact | legacy */
    publishSource: env('LANDING_PUBLISH_SOURCE', 'legacy'),
  }
})

export type ILandingCmsConfig = ConfigType<typeof LandingCmsConfig>
