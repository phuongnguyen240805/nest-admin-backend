/**
 * Plan A — free subdomain URL helpers (Nest-side, pure).
 * Mirrors ladipage-fe-v2 free-subdomain.service for consistent publicUrl shape.
 * https://{slug}.{FREE_SITE_DOMAIN}
 */

export const FREE_SUBDOMAIN_RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'static',
  'cdn',
  'mail',
  'ftp',
  'localhost',
  'staging',
  'fallback',
  'edge',
  'assets',
  'media',
  'docs',
  'status',
  'dev',
  'test',
  'internal',
])

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function isFreeSubdomainEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.LANDING_FREE_SUBDOMAIN_ENABLED === 'true'
}

export function getFreeSiteDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw =
    env.FREE_SITE_DOMAIN?.trim() ||
    env.NEXT_PUBLIC_FREE_SITE_DOMAIN?.trim() ||
    ''
  if (!raw) return null
  return raw
    .replace(/^\*\./, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

export function normalizeFreeSubdomainSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

export function isValidFreeSubdomainSlug(slug: string): boolean {
  const normalized = normalizeFreeSubdomainSlug(slug)
  if (!normalized || !SLUG_PATTERN.test(normalized)) return false
  if (FREE_SUBDOMAIN_RESERVED_SLUGS.has(normalized)) return false
  return true
}

export function buildFreeSubdomainUrl(
  slug: string,
  options?: {
    enabled?: boolean
    baseDomain?: string | null
    env?: NodeJS.ProcessEnv
  },
): string | null {
  const env = options?.env ?? process.env
  const enabled = options?.enabled ?? isFreeSubdomainEnabled(env)
  if (!enabled) return null

  const baseDomain =
    options?.baseDomain !== undefined
      ? options.baseDomain
      : getFreeSiteDomain(env)
  if (!baseDomain) return null

  const normalizedSlug = normalizeFreeSubdomainSlug(slug)
  if (!isValidFreeSubdomainSlug(normalizedSlug)) return null

  const base = baseDomain.replace(/^\*\./, '').replace(/\/$/, '').toLowerCase()
  if (!base || base.includes('/') || base.includes('://')) return null

  return `https://${normalizedSlug}.${base}`
}

export function pickPublicUrl(input: {
  customPublicUrl?: string | null
  subdomainUrl?: string | null
  platformUrl: string
}): string {
  if (input.customPublicUrl) return input.customPublicUrl
  if (input.subdomainUrl) return input.subdomainUrl
  return input.platformUrl
}
