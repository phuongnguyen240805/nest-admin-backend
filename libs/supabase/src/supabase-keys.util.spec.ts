import {
  assertPublicSupabaseKey,
  detectSupabaseKeyKind,
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
} from './supabase-keys.util'

const ANON_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.x'
const SECRET_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x'

describe('supabase-keys.util', () => {
  describe('detectSupabaseKeyKind', () => {
    it('detects publishable key prefix', () => {
      expect(detectSupabaseKeyKind('sb_publishable_abc')).toBe('publishable')
    })

    it('detects secret key prefix', () => {
      expect(detectSupabaseKeyKind('sb_secret_abc')).toBe('secret')
    })

    it('detects anon JWT role', () => {
      expect(detectSupabaseKeyKind(ANON_JWT)).toBe('anon')
    })

    it('detects service_role JWT role', () => {
      expect(detectSupabaseKeyKind(SECRET_JWT)).toBe('secret')
    })
  })

  describe('assertPublicSupabaseKey', () => {
    it('allows publishable and anon keys', () => {
      expect(() => assertPublicSupabaseKey('sb_publishable_x', 'TEST')).not.toThrow()
      expect(() => assertPublicSupabaseKey(ANON_JWT, 'TEST')).not.toThrow()
    })

    it('rejects secret keys', () => {
      expect(() => assertPublicSupabaseKey('sb_secret_x', 'TEST')).toThrow(/SECRET key/)
      expect(() => assertPublicSupabaseKey(SECRET_JWT, 'TEST')).toThrow(/SECRET key/)
    })
  })

  describe('resolveSupabasePublishableKey', () => {
    it('prefers SUPABASE_PUBLISHABLE_KEY', () => {
      const result = resolveSupabasePublishableKey({
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_primary',
        SUPABASE_ANON_KEY: ANON_JWT,
      } as unknown as NodeJS.ProcessEnv)

      expect(result).toMatchObject({
        key: 'sb_publishable_primary',
        source: 'SUPABASE_PUBLISHABLE_KEY',
        kind: 'publishable',
      })
    })

    it('falls back to SUPABASE_ANON_KEY', () => {
      const result = resolveSupabasePublishableKey({
        SUPABASE_ANON_KEY: ANON_JWT,
      } as unknown as NodeJS.ProcessEnv)

      expect(result.source).toBe('SUPABASE_ANON_KEY')
      expect(result.kind).toBe('anon')
    })

    it('supports deprecated SUPABASE_KEY with warning source', () => {
      const result = resolveSupabasePublishableKey({
        SUPABASE_KEY: 'sb_publishable_legacy',
      } as unknown as NodeJS.ProcessEnv)

      expect(result.source).toBe('SUPABASE_KEY (deprecated)')
    })
  })

  describe('resolveSupabaseSecretKey', () => {
    it('prefers SUPABASE_SECRET_KEY over deprecated name', () => {
      const key = resolveSupabaseSecretKey({
        SUPABASE_SECRET_KEY: 'sb_secret_new',
        SUPABASE_SERVICE_ROLE_KEY: 'old-secret',
      } as unknown as NodeJS.ProcessEnv)

      expect(key).toBe('sb_secret_new')
    })

    it('falls back to SUPABASE_SERVICE_ROLE_KEY', () => {
      const key = resolveSupabaseSecretKey({
        SUPABASE_SERVICE_ROLE_KEY: SECRET_JWT,
      } as unknown as NodeJS.ProcessEnv)

      expect(key).toBe(SECRET_JWT)
    })
  })
})