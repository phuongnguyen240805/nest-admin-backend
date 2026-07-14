import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { TenantContextService } from '@liora/nest-core'

import {
  ApiKeyService,
  type ValidatedApiKeyContext,
} from '../settings/api-key.service'

export interface McpAuthenticatedRequest extends FastifyRequest {
  mcpApiKey?: ValidatedApiKeyContext
}

@Injectable()
export class McpApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpAuthenticatedRequest>()
    const rawKey = this.extractBearerToken(request)
    const apiKeyContext = await this.apiKeyService.validateRawKey(rawKey)

    this.tenantContext.setTenantId(apiKeyContext.tenantId)
    this.tenantContext.setOrganizationId(apiKeyContext.organizationId)
    request.mcpApiKey = apiKeyContext

    return true
  }

  private extractBearerToken(request: FastifyRequest): string {
    const authorization = request.headers.authorization
    const value = Array.isArray(authorization) ? authorization[0] : authorization
    if (!value?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer API key')
    }
    return value.slice('Bearer '.length).trim()
  }
}
