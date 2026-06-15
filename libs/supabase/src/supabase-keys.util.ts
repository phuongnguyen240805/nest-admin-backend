export type SupabaseKeyKind = 'publishable' | 'anon' | 'secret' | 'unknown'

export type SupabasePublicKeySource =
  | 'SUPABASE_PUBLISHABLE_KEY'
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_KEY (deprecated)'
  | 'none'

export interface ResolvedSupabasePublicKey {
  key: string
  source: SupabasePublicKeySource
  kind: SupabaseKeyKind
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3)
    return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(base64, 'base64').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  }
  catch {
    return null
  }
}

/** Classify a Supabase API key by format / JWT role claim. */
export function detectSupabaseKeyKind(key: string): SupabaseKeyKind {
  if (!key?.trim())
    return 'unknown'

  if (key.startsWith('sb_publishable_'))
    return 'publishable'

  if (key.startsWith('sb_secret_'))
    return 'secret'

  const payload = decodeJwtPayload(key)
  if (payload?.role === 'service_role')
    return 'secret'

  if (payload?.role === 'anon')
    return 'anon'

  return 'unknown'
}

export function assertPublicSupabaseKey(key: string, envName: string): void {
  const kind = detectSupabaseKeyKind(key)

  if (kind === 'secret') {
    throw new Error(
      `${envName} is a SECRET key (service_role). `
      + 'Use SUPABASE_SECRET_KEY for server-admin only. '
      + 'Public auth requires SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY.',
    )
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value?.trim())
      return value.trim()
  }
  return ''
}

/**
 * Resolve the public Supabase key used for auth (signUp, signIn, getUser).
 * Priority: SUPABASE_PUBLISHABLE_KEY → SUPABASE_ANON_KEY → SUPABASE_KEY (deprecated).
 */
export function resolveSupabasePublishableKey(env: NodeJS.ProcessEnv = process.env): ResolvedSupabasePublicKey {
  const candidates: Array<{ source: SupabasePublicKeySource, value: string }> = [
    { source: 'SUPABASE_PUBLISHABLE_KEY', value: env.SUPABASE_PUBLISHABLE_KEY ?? '' },
    { source: 'SUPABASE_ANON_KEY', value: env.SUPABASE_ANON_KEY ?? '' },
    { source: 'SUPABASE_KEY (deprecated)', value: env.SUPABASE_KEY ?? '' },
  ]

  for (const candidate of candidates) {
    const value = candidate.value.trim()
    if (!value)
      continue

    assertPublicSupabaseKey(value, candidate.source)

    return {
      key: value,
      source: candidate.source,
      kind: detectSupabaseKeyKind(value),
    }
  }

  return { key: '', source: 'none', kind: 'unknown' }
}

/**
 * Resolve the secret Supabase key (service_role) for server-admin operations.
 * Priority: SUPABASE_SECRET_KEY → SUPABASE_SERVICE_ROLE_KEY (deprecated).
 */
export function resolveSupabaseSecretKey(env: NodeJS.ProcessEnv = process.env): string {
  return firstNonEmpty(
    env.SUPABASE_SECRET_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
  )
}