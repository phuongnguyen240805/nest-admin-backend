import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { TenantContextService } from '@liora/nest-core'

import { AdsExtensionSessionService } from '../services/ads-extension-session.service'

@Injectable()
export class AdsExtensionSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: AdsExtensionSessionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>
      user?: Record<string, unknown>
      adsExtensionSessionId?: string
    }>()
    const authorization = request.headers.authorization
    const deviceHeader = request.headers['x-ads-device-id']
    const deviceId = Array.isArray(deviceHeader) ? deviceHeader[0] : deviceHeader
    const value = Array.isArray(authorization) ? authorization[0] : authorization
    const match = /^Bearer\s+(.+)$/i.exec(value ?? '')
    if (!match) throw new UnauthorizedException('Extension Bearer token is required')
    const session = await this.sessions.authenticate(match[1], deviceId ?? '')
    this.tenantContext.setTenantId(session.tenantId)
    request.user = { id: session.actorId, extensionSessionId: session.id }
    request.adsExtensionSessionId = session.id
    return true
  }
}
