/**
 * Plan B — Cloudflare Custom Hostname helpers (Nest-side, pure + fetch).
 * Mirrors ladipage-fe-v2 cloudflare-saas.client for consistent status mapping.
 */

export type DomainVerifyStatus = 'PENDING' | 'VERIFIED' | 'UNVERIFIED' | 'ERROR'
export type DomainSslStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE'

export function normalizeCustomerHostname(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, '')
      .split(':')[0] ?? ''
  )
}

export function isValidCustomerHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false
  if (hostname.startsWith('.') || hostname.endsWith('.')) return false
  if (!hostname.includes('.')) return false
  return hostname.split('.').every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  )
}

type EnvLike = Record<string, string | undefined>

export function getCustomDomainCnameTarget(
  env: EnvLike = process.env as EnvLike,
): string {
  return (
    env.CUSTOM_DOMAIN_CNAME_TARGET?.trim() ||
    env.CLOUDFLARE_SAAS_FALLBACK_ORIGIN?.trim() ||
    'fallback.liora.app'
  )
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

export function mapCloudflareSslToStatus(
  sslStatus: string | null | undefined,
): DomainSslStatus {
  const s = (sslStatus ?? '').toLowerCase()
  if (s === 'active') return 'ACTIVE'
  if (
    s === 'pending_validation' ||
    s === 'pending_issuance' ||
    s === 'initializing'
  ) {
    return 'PENDING'
  }
  return 'INACTIVE'
}

export function mapCloudflareHostnameToDomainStatus(input: {
  hostnameStatus?: string | null
  sslStatus?: string | null
}): DomainVerifyStatus {
  const h = (input.hostnameStatus ?? '').toLowerCase()
  const ssl = mapCloudflareSslToStatus(input.sslStatus)
  if (h === 'active' && ssl === 'ACTIVE') return 'VERIFIED'
  if (h === 'active' && ssl === 'PENDING') return 'PENDING'
  if (h === 'pending' || h === 'pending_validation') return 'PENDING'
  if (h === 'moved' || h === 'deleted') return 'ERROR'
  if (ssl === 'INACTIVE' && h === 'active') return 'UNVERIFIED'
  return 'PENDING'
}

export function buildEdgeKvKey(hostname: string, pathPrefix: string): string {
  const host = normalizeCustomerHostname(hostname)
  let path = (pathPrefix ?? '/').trim() || '/'
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/+$/, '') || '/'
  return path === '/' ? `${host}/` : `${host}${path}`
}

export function isCloudflareSaasConfigured(
  env: EnvLike = process.env as EnvLike,
): boolean {
  return Boolean(
    env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim(),
  )
}

export function isCustomDomainEdgeEnabled(
  env: EnvLike = process.env as EnvLike,
): boolean {
  return env.LANDING_CUSTOM_DOMAIN_EDGE_ENABLED === 'true'
}
