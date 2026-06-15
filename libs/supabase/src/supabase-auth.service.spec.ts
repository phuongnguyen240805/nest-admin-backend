import { SupabaseAuthService } from './supabase-auth.service'
import { SupabaseService } from './supabase.service'

describe('SupabaseAuthService', () => {
  const getUser = jest.fn()
  const signUp = jest.fn()
  const signInWithPassword = jest.fn()

  const supabaseService = {
    getClient: () => ({
      auth: { getUser, signUp, signInWithPassword },
    }),
  } as unknown as SupabaseService

  let service: SupabaseAuthService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SupabaseAuthService(supabaseService)
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
      })
    })
  })
})