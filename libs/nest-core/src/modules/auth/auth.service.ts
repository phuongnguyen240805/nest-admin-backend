import { Inject, Injectable } from '@nestjs/common'
import Redis from 'ioredis'

import { isEmpty } from 'lodash'
import { SupabaseAuthService, VerifiedSupabaseUser } from '@liora/supabase'
import { InjectRedis } from '~/common/decorators/inject-redis.decorator'

import { BusinessException } from '~/common/exceptions/biz.exception'

import { AppConfig, IAppConfig, ISecurityConfig, SecurityConfig } from '~/config'
import { ErrorEnum } from '~/constants/error-code.constant'
import { genAuthPermKey, genAuthPVKey, genAuthTokenKey, genTokenBlacklistKey } from '~/helper/genRedisKey'

import { UserEntity } from '~/modules/user/user.entity'
import { UserService } from '~/modules/user/user.service'

import { md5 } from '~/utils'

import { LoginLogService } from '../system/log/services/login-log.service'
import { MenuService } from '../system/menu/menu.service'
import { RoleService } from '../system/role/role.service'

import { OrganizationProvisioningService } from '~/modules/tenant/organization-provisioning.service'

import { TokenService } from './services/token.service'
import { IAuthUser } from './interfaces/auth.interface'

@Injectable()
export class AuthService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private menuService: MenuService,
    private roleService: RoleService,
    private userService: UserService,
    private loginLogService: LoginLogService,
    private tokenService: TokenService,
    private organizationProvisioningService: OrganizationProvisioningService,
    private supabaseAuthService: SupabaseAuthService,
    @Inject(SecurityConfig.KEY) private securityConfig: ISecurityConfig,
    @Inject(AppConfig.KEY) private appConfig: IAppConfig,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findUserByEmail(this.normalizeEmail(email))

    if (isEmpty(user))
      throw new BusinessException(ErrorEnum.USER_NOT_FOUND)

    const comparePassword = md5(`${password}${user.psalt}`)
    if (user.password !== comparePassword)
      throw new BusinessException(ErrorEnum.INVALID_USERNAME_PASSWORD)

    if (user) {
      const { password, ...result } = user
      return result
    }

    return null
  }

  /**
   * 获取登录JWT
   * 返回null则账号密码有误，不存在该用户
   */
  async login(
    email: string,
    password: string,
    ip: string,
    ua: string,
  ): Promise<string> {
    const user = await this.userService.findUserByEmail(this.normalizeEmail(email))
    if (isEmpty(user))
      throw new BusinessException(ErrorEnum.INVALID_USERNAME_PASSWORD)

    const comparePassword = md5(`${password}${user.psalt}`)
    if (user.password !== comparePassword)
      throw new BusinessException(ErrorEnum.INVALID_USERNAME_PASSWORD)

    return this.issueLoginToken(user, ip, ua)
  }

  /**
   * Server-side Supabase password login → internal Nest JWT.
   * Used by POST /auth/login when USE_SUPABASE_AUTH=true.
   */
  async loginWithSupabasePassword(
    email: string,
    password: string,
    ip: string,
    ua: string,
  ): Promise<string> {
    const normalizedEmail = this.normalizeEmail(email)

    try {
      const signInResult = await this.supabaseAuthService.signInWithPassword(normalizedEmail, password)
      return this.loginWithSupabaseAccessToken(signInResult.accessToken, ip, ua)
    }
    catch (error) {
      if (error instanceof BusinessException) {
        throw error
      }
      throw new BusinessException(ErrorEnum.INVALID_USERNAME_PASSWORD)
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  /**
   * Exchange a Supabase access token for an internal Nest JWT.
   * Client signs in via Supabase SDK first, then calls POST /auth/exchange.
   */
  async loginWithSupabaseAccessToken(
    supabaseAccessToken: string,
    ip: string,
    ua: string,
  ): Promise<string> {
    const supabaseUser = await this.supabaseAuthService.verifyAccessToken(supabaseAccessToken)
    return this.exchangeSupabaseSession(supabaseUser, ip, ua)
  }

  /**
   * Issue internal JWT after Supabase token has been verified.
   */
  async exchangeSupabaseSession(
    supabaseUser: VerifiedSupabaseUser,
    ip: string,
    ua: string,
  ): Promise<string> {
    if (!supabaseUser.emailConfirmed) {
      throw new BusinessException('1211:Vui lòng xác nhận email trước khi đăng nhập.')
    }

    let user = await this.userService.findUserBySupabaseId(supabaseUser.id)

    if (isEmpty(user) && supabaseUser.email) {
      user = await this.userService.findUserByEmail(supabaseUser.email)
      if (user && !user.supabaseUserId) {
        await this.userService.linkSupabaseUser(user.id, supabaseUser.id)
        user = await this.userService.findUserById(user.id)
      }
    }

    if (isEmpty(user)) {
      throw new BusinessException(ErrorEnum.USER_NOT_FOUND)
    }

    return this.issueLoginToken(user, ip, ua)
  }

  /**
   * Re-issue Nest JWT with fresh tenant claims (for sessions created before workspace provisioning).
   */
  async reissueAccessToken(uid: number, ip: string, ua: string): Promise<string> {
    const user = await this.userService.findUserById(uid)
    if (isEmpty(user))
      throw new BusinessException(ErrorEnum.USER_NOT_FOUND)

    return this.issueLoginToken(user, ip, ua)
  }

  private async issueLoginToken(user: UserEntity, ip: string, ua: string): Promise<string> {
    const roleIds = await this.roleService.getRoleIdsByUser(user.id)
    const roles = await this.roleService.getRoleValues(roleIds)

    const workspace = await this.organizationProvisioningService.ensureWorkspaceForUser(user.id)
    const tenantContext = {
      organizationId: workspace.organizationId,
      tenantId: workspace.tenantId,
      activeTenantId: workspace.tenantId,
    }

    const token = await this.tokenService.generateAccessToken(user.id, roles, tenantContext)

    await this.redis.set(genAuthTokenKey(user.id), token.accessToken, 'EX', this.securityConfig.jwtExprire)
    await this.redis.set(genAuthPVKey(user.id), 1)

    const permissions = await this.menuService.getPermissions(user.id)
    await this.setPermissionsCache(user.id, permissions)
    await this.loginLogService.create(user.id, ip, ua)

    return token.accessToken
  }

  /**
   * 效验账号密码
   */
  async checkPassword(username: string, password: string) {
    const user = await this.userService.findUserByUserName(username)

    const comparePassword = md5(`${password}${user.psalt}`)
    if (user.password !== comparePassword)
      throw new BusinessException(ErrorEnum.INVALID_USERNAME_PASSWORD)
  }

  async loginLog(uid: number, ip: string, ua: string) {
    await this.loginLogService.create(uid, ip, ua)
  }

  /**
   * 重置密码
   */
  async resetPassword(username: string, password: string) {
    const user = await this.userService.findUserByUserName(username)

    await this.userService.forceUpdatePassword(user.id, password)
  }

  /**
   * 清除登录状态信息
   */
  async clearLoginStatus(user: IAuthUser, accessToken: string): Promise<void> {
    const exp = user.exp ? (user.exp - Date.now() / 1000).toFixed(0) : this.securityConfig.jwtExprire
    await this.redis.set(genTokenBlacklistKey(accessToken), accessToken, 'EX', exp)
    if (this.appConfig.multiDeviceLogin)
      await this.tokenService.removeAccessToken(accessToken)
    else
      await this.userService.forbidden(user.uid, accessToken)
  }

  /**
   * 获取菜单列表
   */
  async getMenus(uid: number) {
    return this.menuService.getMenus(uid)
  }

  /**
   * 获取权限列表
   */
  async getPermissions(uid: number): Promise<string[]> {
    return this.menuService.getPermissions(uid)
  }

  async getPermissionsCache(uid: number): Promise<string[]> {
    const permissionString = await this.redis.get(genAuthPermKey(uid))
    return permissionString ? JSON.parse(permissionString) : []
  }

  async setPermissionsCache(uid: number, permissions: string[]): Promise<void> {
    await this.redis.set(genAuthPermKey(uid), JSON.stringify(permissions))
  }

  async getPasswordVersionByUid(uid: number): Promise<string> {
    return this.redis.get(genAuthPVKey(uid))
  }

  async getTokenByUid(uid: number): Promise<string> {
    return this.redis.get(genAuthTokenKey(uid))
  }
}
