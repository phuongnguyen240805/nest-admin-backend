import { SupabaseAuthService } from '@liora/supabase'

import { BusinessException } from '~/common/exceptions/biz.exception'
import { ErrorEnum } from '~/constants/error-code.constant'

import { UserEntity } from '~/modules/user/user.entity'
import { UserService } from '~/modules/user/user.service'

import { LoginLogService } from '../system/log/services/login-log.service'
import { MenuService } from '../system/menu/menu.service'
import { RoleService } from '../system/role/role.service'

import { AuthService } from './auth.service'
import { TokenService } from './services/token.service'

describe('AuthService — Supabase hybrid', () => {
  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn(),
  }

  const menuService = {
    getPermissions: jest.fn().mockResolvedValue(['sys:user:list']),
  } as unknown as MenuService

  const roleService = {
    getRoleIdsByUser: jest.fn().mockResolvedValue([1]),
    getRoleValues: jest.fn().mockResolvedValue(['admin']),
  } as unknown as RoleService

  const loginLogService = {
    create: jest.fn().mockResolvedValue(undefined),
  } as unknown as LoginLogService

  const tokenService = {
    generateAccessToken: jest.fn().mockResolvedValue({
      accessToken: 'nest-jwt-token',
      refreshToken: 'nest-refresh',
    }),
    rotateRefreshToken: jest.fn(),
    removeAccessToken: jest.fn().mockResolvedValue(undefined),
  } as unknown as TokenService

  const organizationProvisioningService = {
    ensureWorkspaceForUser: jest.fn().mockResolvedValue({
      organizationId: 'org-uuid',
      tenantId: 1,
      organization: { id: 'org-uuid', name: 'Test Org' },
      tenant: { id: 1 },
    }),
  }

  const supabaseAuthService = {
    verifyAccessToken: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithGoogleIdToken: jest.fn(),
  } as unknown as SupabaseAuthService

  const userService = {
    findUserBySupabaseId: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByUserName: jest.fn(),
    linkSupabaseUser: jest.fn(),
    findUserById: jest.fn(),
    forbidden: jest.fn(),
    register: jest.fn(),
  } as unknown as UserService

  const securityConfig = { jwtExprire: 3600, refreshSecret: 'r', refreshExpire: 86400 }
  const appConfig = { multiDeviceLogin: true }

  let service: AuthService

  const baseUser = {
    id: 42,
    username: 'testuser',
    supabaseUserId: 'supabase-uuid',
  } as UserEntity

  beforeEach(() => {
    jest.clearAllMocks()
    appConfig.multiDeviceLogin = true
    service = new AuthService(
      redis as any,
      menuService,
      roleService,
      userService,
      loginLogService,
      tokenService,
      organizationProvisioningService as any,
      supabaseAuthService,
      securityConfig as any,
      appConfig as any,
    )
  })

  describe('registerWithGoogleIdToken', () => {
    it('creates a local user from a verified Google identity without issuing a login session', async () => {
      ;(supabaseAuthService.signInWithGoogleIdToken as jest.Mock).mockResolvedValue({
        id: '12345678-1234-1234-1234-123456789abc',
        email: ' New.User@gmail.com ',
        emailConfirmed: true,
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(undefined)
      ;(userService.findUserByEmail as jest.Mock).mockResolvedValue(undefined)
      ;(userService.register as jest.Mock).mockResolvedValue(undefined)

      const result = await service.registerWithGoogleIdToken('google-id-token', 'raw-nonce')

      expect(supabaseAuthService.signInWithGoogleIdToken).toHaveBeenCalledWith(
        'google-id-token',
        'raw-nonce',
      )
      expect(userService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'new.user-12345678',
          email: 'new.user@gmail.com',
          lang: 'VI',
          password: expect.stringMatching(/^A1[A-Za-z0-9_-]{14}$/),
        }),
        '12345678-1234-1234-1234-123456789abc',
      )
      expect(tokenService.generateAccessToken).not.toHaveBeenCalled()
      expect(result).toEqual({
        message: 'Đăng ký Google thành công. Hãy đăng nhập bằng Google.',
      })
    })

    it('links an existing local account with the same verified email', async () => {
      const existingUser = { id: 7, email: 'legacy@gmail.com', supabaseUserId: null } as UserEntity
      ;(supabaseAuthService.signInWithGoogleIdToken as jest.Mock).mockResolvedValue({
        id: 'new-google-uuid',
        email: 'legacy@gmail.com',
        emailConfirmed: true,
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(undefined)
      ;(userService.findUserByEmail as jest.Mock).mockResolvedValue(existingUser)

      const result = await service.registerWithGoogleIdToken('google-id-token')

      expect(userService.linkSupabaseUser).toHaveBeenCalledWith(7, 'new-google-uuid')
      expect(userService.register).not.toHaveBeenCalled()
      expect(result.message).toContain('đã được liên kết với Google')
    })

    it('rejects Google registration when the Supabase identity is already registered locally', async () => {
      ;(supabaseAuthService.signInWithGoogleIdToken as jest.Mock).mockResolvedValue({
        id: 'supabase-uuid',
        email: 'u@gmail.com',
        emailConfirmed: true,
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      try {
        await service.registerWithGoogleIdToken('google-id-token')
        fail('expected BusinessException')
      }
      catch (error) {
        expect(error).toBeInstanceOf(BusinessException)
        expect((error as BusinessException).getErrorCode()).toBe(1216)
      }

      expect(userService.register).not.toHaveBeenCalled()
    })
  })

  describe('exchangeSupabaseSession', () => {
    it('issues Nest JWT when user found by supabase_user_id', async () => {
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      const token = await service.exchangeSupabaseSession(
        { id: 'supabase-uuid', email: 'u@test.com', emailConfirmed: true },
        '127.0.0.1',
        'jest',
      )

      expect(token).toEqual({
        token: 'nest-jwt-token',
        refreshToken: 'nest-refresh',
      })
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(42, ['admin'], {
        organizationId: 'org-uuid',
        tenantId: 1,
        activeTenantId: 1,
        appCode: undefined,
      }, 1)
      expect(loginLogService.create).toHaveBeenCalledWith(42, '127.0.0.1', 'jest')
    })

    it('preserves the current password version when issuing a new session', async () => {
      ;(redis.get as jest.Mock).mockResolvedValueOnce('3')
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      await service.exchangeSupabaseSession(
        { id: 'supabase-uuid', email: 'u@test.com', emailConfirmed: true },
        '127.0.0.1',
        'jest',
      )

      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(42, ['admin'], {
        organizationId: 'org-uuid',
        tenantId: 1,
        activeTenantId: 1,
        appCode: undefined,
      }, 3)
      expect(redis.set).toHaveBeenCalledWith(expect.any(String), 3)
    })

    it('rejects unconfirmed email', async () => {
      try {
        await service.exchangeSupabaseSession(
          { id: 'uuid', email: 'u@test.com', emailConfirmed: false },
          '127.0.0.1',
          'jest',
        )
        fail('expected BusinessException')
      }
      catch (error) {
        expect(error).toBeInstanceOf(BusinessException)
        expect((error as BusinessException).getErrorCode()).toBe(1211)
      }
    })

    it('links legacy user by email when supabase_user_id missing', async () => {
      const legacyUser = { id: 7, username: 'legacy', supabaseUserId: null } as UserEntity
      const linkedUser = { ...legacyUser, supabaseUserId: 'new-uuid' } as UserEntity

      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(undefined)
      ;(userService.findUserByEmail as jest.Mock).mockResolvedValue(legacyUser)
      ;(userService.findUserById as jest.Mock).mockResolvedValue(linkedUser)

      const token = await service.exchangeSupabaseSession(
        { id: 'new-uuid', email: 'legacy@test.com', emailConfirmed: true },
        '10.0.0.1',
        'jest',
      )

      expect(userService.linkSupabaseUser).toHaveBeenCalledWith(7, 'new-uuid')
      expect(token).toEqual({
        token: 'nest-jwt-token',
        refreshToken: 'nest-refresh',
      })
    })

    it('rejects email fallback when the local user is linked to another Supabase identity', async () => {
      const linkedToAnotherIdentity = {
        id: 7,
        username: 'linked-user',
        supabaseUserId: 'different-supabase-uuid',
      } as UserEntity

      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(undefined)
      ;(userService.findUserByEmail as jest.Mock).mockResolvedValue(linkedToAnotherIdentity)

      try {
        await service.exchangeSupabaseSession(
          { id: 'incoming-supabase-uuid', email: 'linked@test.com', emailConfirmed: true },
          '127.0.0.1',
          'jest',
        )
        fail('expected BusinessException')
      }
      catch (error) {
        expect(error).toBeInstanceOf(BusinessException)
        expect((error as BusinessException).getErrorCode()).toBe(1101)
      }

      expect(userService.linkSupabaseUser).not.toHaveBeenCalled()
    })

    it('throws USER_NOT_FOUND when no matching sys_user', async () => {
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(undefined)
      ;(userService.findUserByEmail as jest.Mock).mockResolvedValue(undefined)

      try {
        await service.exchangeSupabaseSession(
          { id: 'orphan-uuid', email: 'orphan@test.com', emailConfirmed: true },
          '127.0.0.1',
          'jest',
        )
        fail('expected BusinessException')
      }
      catch (error) {
        expect(error).toBeInstanceOf(BusinessException)
        expect((error as BusinessException).getErrorCode()).toBe(1017)
      }
    })
  })

  describe('loginWithSupabasePassword', () => {
    it('signs in via Supabase then issues Nest JWT when identifier is email', async () => {
      ;(supabaseAuthService.signInWithPassword as jest.Mock).mockResolvedValue({
        accessToken: 'supabase-access',
        supabaseUserId: 'supabase-uuid',
        user: {
          id: 'supabase-uuid',
          email: 'u@test.com',
          emailConfirmed: true,
        },
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      const token = await service.loginWithSupabasePassword(
        'u@test.com',
        'Password1',
        '127.0.0.1',
        'jest',
      )

      expect(supabaseAuthService.signInWithPassword).toHaveBeenCalledWith('u@test.com', 'Password1')
      expect(token).toEqual({
        token: 'nest-jwt-token',
        refreshToken: 'nest-refresh',
      })
      expect(supabaseAuthService.verifyAccessToken).not.toHaveBeenCalled()
    })

    it('normalizes email before Supabase sign-in', async () => {
      ;(supabaseAuthService.signInWithPassword as jest.Mock).mockResolvedValue({
        accessToken: 'supabase-access',
        supabaseUserId: 'supabase-uuid',
        user: {
          id: 'supabase-uuid',
          email: 'u@test.com',
          emailConfirmed: true,
        },
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      await service.loginWithSupabasePassword(
        '  U@Test.COM ',
        'Password1',
        '127.0.0.1',
        'jest',
      )

      expect(supabaseAuthService.signInWithPassword).toHaveBeenCalledWith('u@test.com', 'Password1')
      expect(supabaseAuthService.verifyAccessToken).not.toHaveBeenCalled()
    })
  })

  describe('loginWithSupabaseAccessToken', () => {
    it('delegates to verifyAccessToken then exchangeSupabaseSession', async () => {
      ;(supabaseAuthService.verifyAccessToken as jest.Mock).mockResolvedValue({
        id: 'supabase-uuid',
        email: 'u@test.com',
        emailConfirmed: true,
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      const token = await service.loginWithSupabaseAccessToken('supabase-jwt', '1.1.1.1', 'agent')

      expect(supabaseAuthService.verifyAccessToken).toHaveBeenCalledWith('supabase-jwt')
      expect(token).toEqual({
        token: 'nest-jwt-token',
        refreshToken: 'nest-refresh',
      })
    })
  })

  describe('loginWithGoogleIdToken', () => {
    it('authenticates Google identity through Supabase then issues Nest tokens', async () => {
      ;(supabaseAuthService.signInWithGoogleIdToken as jest.Mock).mockResolvedValue({
        id: 'supabase-uuid',
        email: 'u@test.com',
        emailConfirmed: true,
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      const session = await service.loginWithGoogleIdToken(
        'google-id-token',
        'raw-nonce',
        '127.0.0.1',
        'jest',
      )

      expect(supabaseAuthService.signInWithGoogleIdToken).toHaveBeenCalledWith(
        'google-id-token',
        'raw-nonce',
      )
      expect(session).toEqual({
        token: 'nest-jwt-token',
        refreshToken: 'nest-refresh',
      })
    })

    it('maps provider verification failures to the Google login business error', async () => {
      ;(supabaseAuthService.signInWithGoogleIdToken as jest.Mock).mockRejectedValue(
        new Error('provider rejected token'),
      )

      try {
        await service.loginWithGoogleIdToken(
          'bad-google-token',
          undefined,
          '127.0.0.1',
          'jest',
        )
        fail('expected BusinessException')
      }
      catch (error) {
        expect(error).toBeInstanceOf(BusinessException)
        expect((error as BusinessException).getErrorCode()).toBe(1214)
      }
    })
  })

  describe('clearLoginStatus', () => {
    it('always removes the persisted token pair for the current session', async () => {
      await service.clearLoginStatus(
        { uid: 42, pv: 1, exp: Math.floor(Date.now() / 1000) + 300 },
        'current-access',
      )

      expect(tokenService.removeAccessToken).toHaveBeenCalledWith('current-access')
      expect(userService.forbidden).not.toHaveBeenCalled()
    })

    it('also clears single-device Redis session state', async () => {
      appConfig.multiDeviceLogin = false

      await service.clearLoginStatus(
        { uid: 42, pv: 1, exp: Math.floor(Date.now() / 1000) + 300 },
        'current-access',
      )

      expect(tokenService.removeAccessToken).toHaveBeenCalledWith('current-access')
      expect(userService.forbidden).toHaveBeenCalledWith(42)
    })
  })

  describe('refreshSession', () => {
    it('rotates a Nest refresh token and refreshes permission cache', async () => {
      ;(tokenService.rotateRefreshToken as jest.Mock).mockResolvedValue({
        uid: 42,
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh',
      })

      const session = await service.refreshSession('old-refresh')

      expect(session).toEqual({
        token: 'rotated-access',
        refreshToken: 'rotated-refresh',
      })
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        'rotated-access',
        'EX',
        3600,
      )
      expect(menuService.getPermissions).toHaveBeenCalledWith(42)
    })

    it('rejects an invalid or replayed refresh token', async () => {
      ;(tokenService.rotateRefreshToken as jest.Mock).mockResolvedValue(null)

      try {
        await service.refreshSession('invalid-refresh')
        fail('expected BusinessException')
      }
      catch (error) {
        expect(error).toBeInstanceOf(BusinessException)
        expect((error as BusinessException).getErrorCode()).toBe(1101)
      }
    })
  })
})