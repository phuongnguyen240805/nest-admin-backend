/**
 * URL policy for Unlighthouse targets.
 * - Blocks SSRF-ish targets (file, metadata IPs, etc.)
 * - Allows public http(s) and local hosts only when explicitly enabled (dev/preview).
 */

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata',
])

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'host.docker.internal',
])

export type UrlPolicyResult =
  | { ok: true; url: string; kind: 'public' | 'local' | 'preview' }
  | { ok: false; reason: string }

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const parts = m.slice(1).map(Number)
  if (parts.some((n) => n > 255)) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

export function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase()
  if (LOCAL_HOSTS.has(h)) return true
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.test')) return true
  if (isPrivateIpv4(h)) return true
  return false
}

/**
 * @param allowLocal - only for editor/list pre-publish or explicit dev; never for untrusted input alone
 */
export function assertScanableUrl(
  raw: string | null | undefined,
  options?: { allowLocal?: boolean; previewHostSuffixes?: string[] },
): UrlPolicyResult {
  const allowLocal = options?.allowLocal === true
  const previewSuffixes = options?.previewHostSuffixes ?? []

  if (!raw?.trim()) {
    return { ok: false, reason: 'Target URL is required for Lighthouse scan' }
  }

  let url: URL
  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(raw.trim())
      ? raw.trim()
      : `https://${raw.trim()}`
    url = new URL(withProtocol)
  } catch {
    return { ok: false, reason: 'Invalid target URL' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http(s) URLs are allowed' }
  }

  const host = url.hostname.toLowerCase()
  if (!host || BLOCKED_HOSTS.has(host)) {
    return { ok: false, reason: 'Host is not allowed' }
  }

  // Block cloud metadata / link-local even if "local" allowed
  if (host === '169.254.169.254' || host.endsWith('.internal')) {
    return { ok: false, reason: 'Host is not allowed' }
  }

  const local = isLocalHostname(host)
  const isPreview =
    previewSuffixes.length > 0 &&
    previewSuffixes.some((s) => host === s || host.endsWith(`.${s}`))

  if (local && !allowLocal) {
    return {
      ok: false,
      reason:
        'Local/private hosts require allowLocal (editor pre-publish). Use a public URL or enable local scan.',
    }
  }

  if (local) {
    return { ok: true, url: url.toString(), kind: 'local' }
  }
  if (isPreview) {
    return { ok: true, url: url.toString(), kind: 'preview' }
  }
  return { ok: true, url: url.toString(), kind: 'public' }
}

export function phaseForTrigger(
  trigger: 'editor' | 'list' | 'ai_seo' | 'publish',
  kind: 'public' | 'local' | 'preview',
): 'pre_publish' | 'post_publish' {
  if (trigger === 'publish') return 'post_publish'
  if (kind === 'public' && trigger === 'ai_seo') return 'post_publish'
  if (kind === 'public' && trigger === 'list') return 'post_publish'
  return 'pre_publish'
}
