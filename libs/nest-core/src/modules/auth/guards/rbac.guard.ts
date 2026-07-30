import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FastifyRequest } from 'fastify'

import { BusinessException } from '~/common/exceptions/biz.exception'
import { ErrorEnum } from '~/constants/error-code.constant'
import { AuthService } from '~/modules/auth/auth.service'

import { ALLOW_ANON_KEY, PERMISSION_KEY, PUBLIC_KEY, Roles } from '../auth.constant'

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const { user } = request
    if (!user) throw new BusinessException(ErrorEnum.INVALID_LOGIN)

    const allowAnon = this.reflector.get<boolean>(
      ALLOW_ANON_KEY,
      context.getHandler(),
    )
    if (allowAnon) return true

    const required = this.reflector.getAllAndOverride<string | string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required) return true
    if (user.roles.includes(Roles.ADMIN)) return true

    const hasRequired = (permissions: string[]): boolean => {
      const values = Array.isArray(required) ? required : [required]
      return values.every(permission => permissions.includes(permission))
    }

    let permissions =
      await this.authService.getPermissionsCache(user.uid)
      ?? await this.authService.getPermissions(user.uid)

    // Permission migrations or role edits can leave an active Redis session
    // stale. Refresh once from PostgreSQL before returning a denial.
    if (!hasRequired(permissions)) {
      permissions = await this.authService.getPermissions(user.uid)
      await this.authService.setPermissionsCache(user.uid, permissions)
    }

    if (!hasRequired(permissions))
      throw new BusinessException(ErrorEnum.NO_PERMISSION)

    return true
  }
}
