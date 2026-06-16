import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { TenantContextService } from './tenant-context.service'
import { TenantRequestBootstrapService } from './tenant-request-bootstrap.service'

/**
 * Single tenant guard for all business APIs (Billing, Ecom, CRM, Settings, …).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantBootstrap: TenantRequestBootstrapService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()

    if (!this.tenantContext.isReady()) {
      await this.tenantBootstrap.ensureRequestTenantContext(request)
    }

    if (!this.tenantContext.isReady()) {
      throw new ForbiddenException(
        'Workspace context is required. Re-login after registration or contact support.',
      )
    }

    if (!request.org) {
      throw new ForbiddenException(
        'Organization context is missing. Ensure TenantInterceptor is registered globally.',
      )
    }

    return true
  }
}