import { JwtService } from '@nestjs/jwt'
import dayjs from 'dayjs'

import { RoleService } from '~/modules/system/role/role.service'
import { UserStatus } from '~/modules/user/constant'

import { AccessTokenEntity } from '../entities/access-token.entity'
import { RefreshTokenEntity } from '../entities/refresh-token.entity'
import { TokenService } from './token.service'

describe('TokenService refresh rotation', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
    signAsync: jest.fn(),
    sign: jest.fn(),
  } as unknown as JwtService

  const roleService = {
    getRoleIdsByUser: jest.fn().mockResolvedValue([1]),
    getRoleValues: jest.fn().mockResolvedValue(['admin']),
  } as unknown as RoleService

  const organizationProvisioningService = {
    ensureWorkspaceForUser: jest.fn().mockResolvedValue({
      organizationId: 'org-uuid',
      tenantId: 1,
      appCode: 'ladipage',
    }),
  }

  const redis = {
    get: jest.fn().mockResolvedValue('1'),
    del: jest.fn().mockResolvedValue(1),
  }

  const securityConfig = {
    jwtExprire: 3600,
    refreshSecret: 'refresh-secret',
    refreshExpire: 86400,
  }

  let service: TokenService

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    service = new TokenService(
      jwtService,
      roleService,
      organizationProvisioningService as any,
      redis as any,
      securityConfig as any,
    )
  })

  function mockStoredRefreshToken() {
    return {
      id: 'refresh-row',
      value: 'refresh-token',
      expired_at: dayjs().add(1, 'hour').toDate(),
      accessToken: {
        id: 'access-row',
        value: 'expired-access-token',
        user: {
          id: 42,
          status: UserStatus.Enabled,
        },
      },
    } as RefreshTokenEntity
  }

  it('rejects an invalid refresh JWT before querying persistence', async () => {
    ;(jwtService.verifyAsync as jest.Mock).mockRejectedValueOnce(new Error('invalid signature'))
    const findOne = jest.spyOn(RefreshTokenEntity, 'findOne')

    await expect(service.rotateRefreshToken('bad-refresh')).resolves.toBeNull()
    expect(findOne).not.toHaveBeenCalled()
  })

  it('consumes the refresh row once and issues a fresh token pair', async () => {
    const stored = mockStoredRefreshToken()
    ;(jwtService.verifyAsync as jest.Mock)
      .mockResolvedValueOnce({ uuid: 'refresh-uuid' })
      .mockResolvedValueOnce({ uid: 42, pv: 1 })

    jest.spyOn(RefreshTokenEntity, 'findOne').mockResolvedValue(stored)
    jest.spyOn(RefreshTokenEntity, 'delete').mockResolvedValue({ affected: 1, raw: [] } as any)
    jest.spyOn(AccessTokenEntity, 'delete').mockResolvedValue({ affected: 1, raw: [] } as any)
    jest.spyOn(service, 'generateAccessToken').mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })

    const result = await service.rotateRefreshToken('refresh-token')

    expect(result).toEqual({
      uid: 42,
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })
    expect(RefreshTokenEntity.delete).toHaveBeenCalledWith({ id: 'refresh-row' })
    expect(AccessTokenEntity.delete).toHaveBeenCalledWith({ id: 'access-row' })
    expect(service.generateAccessToken).toHaveBeenCalledWith(42, ['admin'], {
      organizationId: 'org-uuid',
      tenantId: 1,
      activeTenantId: 1,
      appCode: 'ladipage',
    }, 1)
  })

  it('rejects replay when another request already consumed the refresh row', async () => {
    const stored = mockStoredRefreshToken()
    ;(jwtService.verifyAsync as jest.Mock)
      .mockResolvedValueOnce({ uuid: 'refresh-uuid' })
      .mockResolvedValueOnce({ uid: 42, pv: 1 })

    jest.spyOn(RefreshTokenEntity, 'findOne').mockResolvedValue(stored)
    jest.spyOn(RefreshTokenEntity, 'delete').mockResolvedValue({ affected: 0, raw: [] } as any)
    const generate = jest.spyOn(service, 'generateAccessToken')

    await expect(service.rotateRefreshToken('refresh-token')).resolves.toBeNull()
    expect(generate).not.toHaveBeenCalled()
  })

  it('rejects refresh if logout removed the access row during rotation', async () => {
    const stored = mockStoredRefreshToken()
    ;(jwtService.verifyAsync as jest.Mock)
      .mockResolvedValueOnce({ uuid: 'refresh-uuid' })
      .mockResolvedValueOnce({ uid: 42, pv: 1 })

    jest.spyOn(RefreshTokenEntity, 'findOne').mockResolvedValue(stored)
    jest.spyOn(RefreshTokenEntity, 'delete').mockResolvedValue({ affected: 1, raw: [] } as any)
    jest.spyOn(AccessTokenEntity, 'delete').mockResolvedValue({ affected: 0, raw: [] } as any)
    const generate = jest.spyOn(service, 'generateAccessToken')

    await expect(service.rotateRefreshToken('refresh-token')).resolves.toBeNull()
    expect(generate).not.toHaveBeenCalled()
  })

  it('rejects refresh for a disabled user', async () => {
    const stored = mockStoredRefreshToken()
    stored.accessToken.user.status = UserStatus.Disable
    ;(jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce({ uuid: 'refresh-uuid' })

    jest.spyOn(RefreshTokenEntity, 'findOne').mockResolvedValue(stored)
    const consume = jest.spyOn(RefreshTokenEntity, 'delete')

    await expect(service.rotateRefreshToken('refresh-token')).resolves.toBeNull()
    expect(consume).not.toHaveBeenCalled()
  })

  it('rejects refresh after password-version invalidation', async () => {
    const stored = mockStoredRefreshToken()
    ;(jwtService.verifyAsync as jest.Mock)
      .mockResolvedValueOnce({ uuid: 'refresh-uuid' })
      .mockResolvedValueOnce({ uid: 42, pv: 1 })
    ;(redis.get as jest.Mock).mockResolvedValueOnce('2')

    jest.spyOn(RefreshTokenEntity, 'findOne').mockResolvedValue(stored)
    const consume = jest.spyOn(RefreshTokenEntity, 'delete')

    await expect(service.rotateRefreshToken('refresh-token')).resolves.toBeNull()
    expect(consume).not.toHaveBeenCalled()
  })
})
