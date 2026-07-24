/**
 * Resolve scan start URL from publish / page / hostname candidates.
 * Prefers absolute public URLs; falls back to https://{hostname}.
 */

import { extractHostname, isPublicRegistrableDomain } from './domain.util'

export type ScanStartResolution = {
  startUrl: string | null
  host: string
  /** OpenSEO domain overview needs public registrable host */
  canDomainOverview: boolean
  /** Path B-lite needs any absolute http(s) URL that may return HTML */
  canPageAudit: boolean
}

function toAbsoluteUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString().replace(/\/$/, '') === `${url.protocol}//${url.host}`
      ? `${url.protocol}//${url.host}/`
      : url.toString()
  } catch {
    return null
  }
}

/**
 * Pick best start URL: prefer absolute public domain, then any absolute, then host.
 */
export function resolveScanStartUrl(
  candidates: Array<string | null | undefined>,
): ScanStartResolution {
  const absolutes = candidates
    .map((c) => (c?.trim() ? toAbsoluteUrl(c) : null))
    .filter((u): u is string => Boolean(u))

  const preferred =
    absolutes.find((u) => isPublicRegistrableDomain(extractHostname(u))) ?? absolutes[0]

  if (preferred) {
    const host = extractHostname(preferred)
    return {
      startUrl: preferred,
      host,
      canDomainOverview: isPublicRegistrableDomain(host),
      canPageAudit: true,
    }
  }

  for (const raw of candidates) {
    const host = extractHostname(raw ?? '')
    if (!host) continue
    const startUrl = `https://${host}/`
    return {
      startUrl,
      host,
      canDomainOverview: isPublicRegistrableDomain(host),
      canPageAudit: isPublicRegistrableDomain(host),
    }
  }

  return { startUrl: null, host: '', canDomainOverview: false, canPageAudit: false }
}

export function scanBlockedMessage(host: string): string {
  const h = host || '(empty)'
  return (
    `Cannot start SEO scan for "${h}". ` +
    'Publish the landing page with a public domain (or crawlable absolute publicUrl), ' +
    'then retry. Local hosts (localhost, *.local) are not accepted for domain overview.'
  )
}
