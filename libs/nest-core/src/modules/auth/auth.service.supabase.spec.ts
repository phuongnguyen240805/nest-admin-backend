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
  } as unknown as SupabaseAuthService

  const userService = {
    findUserBySupabaseId: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByUserName: jest.fn(),
    linkSupabaseUser: jest.fn(),
    findUserById: jest.fn(),
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

  describe('exchangeSupabaseSession', () => {
    it('issues Nest JWT when user found by supabase_user_id', async () => {
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      const token = await service.exchangeSupabaseSession(
        { id: 'supabase-uuid', email: 'u@test.com', emailConfirmed: true },
        '127.0.0.1',
        'jest',
      )

      expect(token).toBe('nest-jwt-token')
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(42, ['admin'])
      expect(loginLogService.create).toHaveBeenCalledWith(42, '127.0.0.1', 'jest')
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
      expect(token).toBe('nest-jwt-token')
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
      })
      ;(supabaseAuthService.verifyAccessToken as jest.Mock).mockResolvedValue({
        id: 'supabase-uuid',
        email: 'u@test.com',
        emailConfirmed: true,
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      const token = await service.loginWithSupabasePassword(
        'u@test.com',
        'Password1',
        '127.0.0.1',
        'jest',
      )

      expect(supabaseAuthService.signInWithPassword).toHaveBeenCalledWith('u@test.com', 'Password1')
      expect(token).toBe('nest-jwt-token')
    })

    it('normalizes email before Supabase sign-in', async () => {
      ;(supabaseAuthService.signInWithPassword as jest.Mock).mockResolvedValue({
        accessToken: 'supabase-access',
        supabaseUserId: 'supabase-uuid',
      })
      ;(supabaseAuthService.verifyAccessToken as jest.Mock).mockResolvedValue({
        id: 'supabase-uuid',
        email: 'u@test.com',
        emailConfirmed: true,
      })
      ;(userService.findUserBySupabaseId as jest.Mock).mockResolvedValue(baseUser)

      await service.loginWithSupabasePassword(
        '  U@Test.COM ',
        'Password1',
        '127.0.0.1',
        'jest',
      )

      expect(supabaseAuthService.signInWithPassword).toHaveBeenCalledWith('u@test.com', 'Password1')
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
      expect(token).toBe('nest-jwt-token')
    })
  })
})