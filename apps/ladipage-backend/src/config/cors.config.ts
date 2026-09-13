const DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  }
  catch {
    return null
  }
}

export function getAllowedCorsOrigins(): ReadonlySet<string> {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(item => normalizeOrigin(item))
    .filter((item): item is string => Boolean(item))

  const values = configured.length > 0
    ? configured
    : process.env.NODE_ENV === 'production'
      ? []
      : DEV_CORS_ORIGINS

  return new Set(values)
}

export function isAllowedCorsOrigin(origin?: string): boolean {
  // Server-to-server/BFF requests normally have no Origin and do not rely on
  // browser CORS. Browser origins must match the explicit allowlist exactly.
  if (!origin) return true
  const normalized = normalizeOrigin(origin)
  return normalized !== null && getAllowedCorsOrigins().has(normalized)
}

export function ladipageCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  callback(null, isAllowedCorsOrigin(origin))
}
