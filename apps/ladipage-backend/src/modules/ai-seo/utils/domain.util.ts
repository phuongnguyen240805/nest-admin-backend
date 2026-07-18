/**
 * Hostname helpers for AI-SEO / OpenSEO.
 * OpenSEO (tldts) only accepts public registrable hosts — not localhost, IP, bare labels, or UUIDs.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'host.docker.internal'])

/** Strip protocol/path/port/www → bare host (lowercased). */
export function extractHostname(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  const trimmed = value.trim()
  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .replace(/^www\./i, '')
      .toLowerCase()
  }
}

/**
 * True when host is suitable for OpenSEO / DataForSEO domain tools.
 * Rejects: empty, IP, localhost, *.local / *.localhost / *.test / *.invalid,
 * single-label hosts (no TLD), UUID-like labels.
 */
export function isPublicRegistrableDomain(host: string): boolean {
  const h = extractHostname(host)
  if (!h || LOCAL_HOSTS.has(h)) return false
  if (h.endsWith('.local') || h.endsWith('.localhost') || h.endsWith('.test') || h.endsWith('.invalid')) {
    return false
  }
  // IPv4 / IPv6-ish
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false
  if (h.includes(':')) return false
  // Must have a TLD segment
  if (!h.includes('.')) return false
  // UUID as host (no real TLD use case for SEO)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(h)) return false
  // Basic DNS label shape
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(h)) {
    return false
  }
  // TLD at least 2 chars
  const tld = h.split('.').pop() ?? ''
  return tld.length >= 2
}

export function publicDomainErrorMessage(host: string): string {
  const h = extractHostname(host) || host || '(empty)'
  return (
    `OpenSEO requires a public domain like example.com (got "${h}"). ` +
    'Local hosts (localhost, 127.0.0.1, *.local), bare labels, and UUIDs are not accepted.'
  )
}

/**
 * Pick best hostname for SEO project create from publish context + page fields.
 * Prefers public registrable domains when available.
 */
export function resolveSeoHostname(candidates: Array<string | null | undefined>): string {
  const normalized = candidates
    .map((c) => extractHostname(c ?? ''))
    .filter(Boolean)

  const publicHost = normalized.find((h) => isPublicRegistrableDomain(h))
  if (publicHost) return publicHost

  // Prefer non-uuid, multi-label or known local label for storage/display
  const nonUuid = normalized.find(
    (h) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(h),
  )
  return nonUuid || normalized[0] || ''
}
