import type { ISupabaseConfig } from './supabase.config'
import { SupabaseAuthService } from './supabase-auth.service'
import { SupabaseService } from './supabase.service'

describe('SupabaseAuthService', () => {
  const getUser = jest.fn()
  const signUp = jest.fn()
  const signInWithPassword = jest.fn()
  const signInWithIdToken = jest.fn()
  const createUser = jest.fn()

  const supabaseService = {
    getClient: () => ({
      auth: { getUser, signUp, signInWithPassword, signInWithIdToken },
    }),
    hasAdminClient: jest.fn().mockReturnValue(false),
    getAdminClient: () => ({
      auth: { admin: { createUser } },
    }),
  } as unknown as SupabaseService

  const baseConfig = {
    useAdminSignupInDev: false,
  } as ISupabaseConfig

  let service: SupabaseAuthService

  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabaseService.hasAdminClient as jest.Mock).mockReturnValue(false)
    service = new SupabaseAuthService(supabaseService, baseConfig)
  })

  describe('verifyAccessToken', () => {
    it('returns verified user profile on valid token', async () => {
      getUser.mockResolvedValue({
        data: {
          user: {
            id: 'uuid-1',
            email: 'user@test.com',
            confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      })

      const result = await service.verifyAccessToken('valid-token')
      expect(result).toEqual({
        id: 'uuid-1',
        email: 'user@test.com',
        emailConfirmed: true,
      })
      expect(getUser).toHaveBeenCalledWith('valid-token')
    })

    it('throws when Supabase returns error', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid JWT' },
      })

      await expect(service.verifyAccessToken('bad-token')).rejects.toThrow('invalid JWT')
    })
  })

  describe('signUp', () => {
    it('uses admin createUser in dev when configured', async () => {
      ;(supabaseService.hasAdminClient as jest.Mock).mockReturnValue(true)
      const devService = new SupabaseAuthService(supabaseService, {
        ...baseConfig,
        useAdminSignupInDev: true,
      })

      createUser.mockResolvedValue({
        data: { user: { id: 'admin-uuid' } },
        error: null,
      })

      const result = await devService.signUp('user@test.com', 'Password1')
      expect(createUser).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'Password1',
        email_confirm: true,
      })
      expect(result).toMatchObject({
        success: true,
        supabaseUserId: 'admin-uuid',
      })
      expect(signUp).not.toHaveBeenCalled()
    })

    it('returns supabaseUserId and confirmation message when email unconfirmed', async () => {
      signUp.mockResolvedValue({
        data: {
          user: { id: 'new-uuid', confirmed_at: undefined },
          session: null,
        },
        error: null,
      })

      const result = await service.signUp('user@test.com', 'Password1')
      expect(result).toEqual({
        success: true,
        supabaseUserId: 'new-uuid',
        message: 'Please check your email to confirm your registration.',
      })
    })
  })

  describe('signInWithPassword', () => {
    it('returns session tokens on success', async () => {
      signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'uuid-1', confirmed_at: '2026-01-01' },
          session: { access_token: 'at', refresh_token: 'rt' },
        },
        error: null,
      })

      const result = await service.signInWithPassword('user@test.com', 'Password1')
      expect(result).toMatchObject({
        success: true,
        supabaseUserId: 'uuid-1',
        accessToken: 'at',
        refreshToken: 'rt',
        user: {
          id: 'uuid-1',
          email: undefined,
          emailConfirmed: true,
        },
      })
    })
  })

  describe('signInWithGoogleIdToken', () => {
    it('passes Google ID token and nonce to Supabase', async () => {
      signInWithIdToken.mockResolvedValue({
        data: {
          user: {
            id: 'google-uuid',
            email: 'google@test.com',
            confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      })

      const result = await service.signInWithGoogleIdToken('google-id-token', 'raw-nonce')

      expect(signInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'google-id-token',
        nonce: 'raw-nonce',
      })
      expect(result).toEqual({
        id: 'google-uuid',
        email: 'google@test.com',
        emailConfirmed: true,
      })
    })

    it('does not send nonce when caller omitted it', async () => {
      signInWithIdToken.mockResolvedValue({
        data: {
          user: { id: 'google-uuid', confirmed_at: '2026-01-01' },
        },
        error: null,
      })

      await service.signInWithGoogleIdToken('google-id-token')

      expect(signInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'google-id-token',
      })
    })

    it('rejects Supabase provider errors', async () => {
      signInWithIdToken.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid google token' },
      })

      await expect(service.signInWithGoogleIdToken('bad-token')).rejects.toThrow(
        'invalid google token',
      )
    })
  })
})