import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { Observable } from 'rxjs'

import { TenantRequestBootstrapService } from '~/modules/tenant/tenant-request-bootstrap.service'

/**
 * Populates request + CLS tenant context from JWT claims (or lazy workspace provision).
 * Runs after JwtAuthGuard on protected routes.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantBootstrap: TenantRequestBootstrapService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    await this.tenantBootstrap.ensureRequestTenantContext(request)
    return next.handle()
  }
}