import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata',
  'instance-data.ec2.internal',
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
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && (b === 0 || b === 2)) return true
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true
  if (a === 203 && b === 0) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === '::' || h === '::1') return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (/^fe[89ab]/.test(h)) return true
  if (h.startsWith('ff')) return true
  if (h === '2001:db8::' || h.startsWith('2001:db8:')) return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h)
  return mapped ? isPrivateIpv4(mapped[1]) : false
}

function isBlockedIp(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family === 6) return isPrivateIpv6(address)
  return true
}

export function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (LOCAL_HOSTS.has(h)) return true
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.test')) return true
  if (isIP(h) === 4) return isPrivateIpv4(h)
  if (isIP(h) === 6) return isPrivateIpv6(h)
  return false
}

export function assertScanableUrl(
  raw: string | null | undefined,
  options?: { allowLocal?: boolean; previewHostSuffixes?: string[] },
): UrlPolicyResult {
  const allowLocal = options?.allowLocal === true
  const previewSuffixes = options?.previewHostSuffixes ?? []

  if (!raw?.trim()) return { ok: false, reason: 'Target URL is required for Lighthouse scan' }

  let url: URL
  try {
    const value = raw.trim()
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value) ? value : `https://${value}`
    url = new URL(withProtocol)
  } catch {
    return { ok: false, reason: 'Invalid target URL' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http(s) URLs are allowed' }
  }
  if (url.username || url.password) return { ok: false, reason: 'URL userinfo is not allowed' }

  const host = url.hostname.toLowerCase()
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.internal')) {
    return { ok: false, reason: 'Host is not allowed' }
  }

  const local = isLocalHostname(host)
  const allowedPort = !url.port || url.port === '80' || url.port === '443' || (allowLocal && local)
  if (!allowedPort) {
    return { ok: false, reason: 'Target port is not allowed' }
  }

  const isPreview = previewSuffixes.some((s) => host === s || host.endsWith(`.${s}`))
  if (local && !allowLocal) return { ok: false, reason: 'Local/private hosts are not allowed' }
  if (local) return { ok: true, url: url.toString(), kind: 'local' }
  if (isPreview) return { ok: true, url: url.toString(), kind: 'preview' }
  return { ok: true, url: url.toString(), kind: 'public' }
}

/** DNS-aware validation. Call again immediately before every network navigation. */
export async function assertResolvedScanableUrl(
  raw: string,
  options?: { allowLocal?: boolean; previewHostSuffixes?: string[] },
): Promise<UrlPolicyResult> {
  const parsed = assertScanableUrl(raw, options)
  if (!parsed.ok || parsed.kind === 'local') return parsed

  const url = new URL(parsed.url)
  if (isIP(url.hostname)) {
    return isBlockedIp(url.hostname) ? { ok: false, reason: 'Resolved IP is not public' } : parsed
  }

  let addresses: Array<{ address: string }>
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true })
  } catch {
    return { ok: false, reason: 'Target hostname could not be resolved' }
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
    return { ok: false, reason: 'Target hostname resolves to a private/reserved address' }
  }
  return parsed
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
