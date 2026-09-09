import { Inject, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
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
import { LoginToken } from './models/auth.model'

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
  ): Promise<LoginToken> {
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
  ): Promise<LoginToken> {
    const normalizedEmail = this.normalizeEmail(email)

    let supabaseUser: VerifiedSupabaseUser
    try {
      const signInResult = await this.supabaseAuthService.signInWithPassword(normalizedEmail, password)
      supabaseUser = signInResult.user
    }
    catch {
      throw new BusinessException(ErrorEnum.INVALID_USERNAME_PASSWORD)
    }

    return this.exchangeSupabaseSession(supabaseUser, ip, ua)
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
  ): Promise<LoginToken> {
    const supabaseUser = await this.supabaseAuthService.verifyAccessToken(supabaseAccessToken)
    return this.exchangeSupabaseSession(supabaseUser, ip, ua)
  }

  async loginWithGoogleIdToken(
    idToken: string,
    nonce: string | undefined,
    ip: string,
    ua: string,
  ): Promise<LoginToken> {
    let supabaseUser: VerifiedSupabaseUser
    try {
      supabaseUser = await this.supabaseAuthService.signInWithGoogleIdToken(idToken, nonce)
    }
    catch {
      throw new BusinessException(ErrorEnum.GOOGLE_LOGIN_FAILED)
    }

    return this.exchangeSupabaseSession(supabaseUser, ip, ua)
  }

  async registerWithGoogleIdToken(
    idToken: string,
    nonce?: string,
  ): Promise<{ message: string }> {
    let supabaseUser: VerifiedSupabaseUser
    try {
      supabaseUser = await this.supabaseAuthService.signInWithGoogleIdToken(idToken, nonce)
    }
    catch {
      throw new BusinessException(ErrorEnum.GOOGLE_REGISTER_FAILED)
    }

    if (!supabaseUser.emailConfirmed) {
      throw new BusinessException('1211:Vui lòng xác nhận email trước khi đăng ký.')
    }
    if (!supabaseUser.email) {
      throw new BusinessException(ErrorEnum.GOOGLE_REGISTER_FAILED)
    }

    const normalizedEmail = this.normalizeEmail(supabaseUser.email)
    const existingBySupabaseId = await this.userService.findUserBySupabaseId(supabaseUser.id)
    if (existingBySupabaseId) {
      throw new BusinessException(ErrorEnum.GOOGLE_ACCOUNT_ALREADY_REGISTERED)
    }

    const existingByEmail = await this.userService.findUserByEmail(normalizedEmail)
    if (existingByEmail) {
      if (existingByEmail.supabaseUserId && existingByEmail.supabaseUserId !== supabaseUser.id) {
        throw new BusinessException(ErrorEnum.INVALID_LOGIN)
      }

      if (!existingByEmail.supabaseUserId) {
        await this.userService.linkSupabaseUser(existingByEmail.id, supabaseUser.id)
      }

      return {
        message: 'Tài khoản đã tồn tại và đã được liên kết với Google. Hãy đăng nhập bằng Google.',
      }
    }

    const username = this.buildGoogleRegistrationUsername(normalizedEmail, supabaseUser.id)
    const generatedPassword = `A1${randomBytes(11).toString('base64url').slice(0, 14)}`

    await this.userService.register({
      username,
      email: normalizedEmail,
      password: generatedPassword,
      lang: 'VI',
    }, supabaseUser.id)

    return {
      message: 'Đăng ký Google thành công. Hãy đăng nhập bằng Google.',
    }
  }

  private buildGoogleRegistrationUsername(email: string, supabaseUserId: string): string {
    const localPart = email.split('@')[0] ?? 'google'
    const safeLocalPart = localPart
      .replace(/[^a-z0-9._-]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'google'
    const suffix = supabaseUserId.replace(/-/g, '').slice(0, 8)
    return `${safeLocalPart.slice(0, 55)}-${suffix}`
  }

  /**
   * Issue internal JWT after Supabase token has been verified.
   */
  async exchangeSupabaseSession(
    supabaseUser: VerifiedSupabaseUser,
    ip: string,
    ua: string,
  ): Promise<LoginToken> {
    if (!supabaseUser.emailConfirmed) {
      throw new BusinessException('1211:Vui lòng xác nhận email trước khi đăng nhập.')
    }

    let user = await this.userService.findUserBySupabaseId(supabaseUser.id)

    if (isEmpty(user) && supabaseUser.email) {
      user = await this.userService.findUserByEmail(this.normalizeEmail(supabaseUser.email))

      if (user?.supabaseUserId && user.supabaseUserId !== supabaseUser.id)
        throw new BusinessException(ErrorEnum.INVALID_LOGIN)

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
  async reissueAccessToken(uid: number, ip: string, ua: string): Promise<LoginToken> {
    const user = await this.userService.findUserById(uid)
    if (isEmpty(user))
      throw new BusinessException(ErrorEnum.USER_NOT_FOUND)

    return this.issueLoginToken(user, ip, ua)
  }

  private async issueLoginToken(user: UserEntity, ip: string, ua: string): Promise<LoginToken> {
    const roleIds = await this.roleService.getRoleIdsByUser(user.id)
    const roles = await this.roleService.getRoleValues(roleIds)

    const workspace = await this.organizationProvisioningService.ensureWorkspaceForUser(user.id)
    const tenantContext = {
      organizationId: workspace.organizationId,
      tenantId: workspace.tenantId,
      activeTenantId: workspace.tenantId,
      appCode: workspace.appCode,
    }

    const cachedPv = await this.redis.get(genAuthPVKey(user.id))
    const passwordVersion = cachedPv == null ? 1 : Number(cachedPv)
    const token = await this.tokenService.generateAccessToken(
      user.id,
      roles,
      tenantContext,
      passwordVersion,
    )

    await this.redis.set(genAuthTokenKey(user.id), token.accessToken, 'EX', this.securityConfig.jwtExprire)
    await this.redis.set(genAuthPVKey(user.id), passwordVersion)

    const permissions = await this.menuService.getPermissions(user.id)
    await this.setPermissionsCache(user.id, permissions)
    await this.loginLogService.create(user.id, ip, ua)

    return {
      token: token.accessToken,
      refreshToken: token.refreshToken,
    }
  }

  async refreshSession(refreshToken: string): Promise<LoginToken> {
    const rotated = await this.tokenService.rotateRefreshToken(refreshToken)
    if (!rotated)
      throw new BusinessException(ErrorEnum.INVALID_LOGIN)

    await this.redis.set(
      genAuthTokenKey(rotated.uid),
      rotated.accessToken,
      'EX',
      this.securityConfig.jwtExprire,
    )

    const permissions = await this.menuService.getPermissions(rotated.uid)
    await this.setPermissionsCache(rotated.uid, permissions)

    return {
      token: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    }
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
    await this.tokenService.removeAccessToken(accessToken)
    if (!this.appConfig.multiDeviceLogin)
      await this.userService.forbidden(user.uid)
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
