import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { TenantContextService } from './tenant-context.service'

/**
 * Legacy opt-in interceptor kept for modules that have not migrated to the
 * global TenantInterceptor yet.
 *
 * Tenant authority comes exclusively from the verified JWT user. Browser
 * headers/query parameters are intent at most and must never become effective
 * tenant context without membership verification.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const rawTenantId = request.user?.activeTenantId ?? request.user?.tenantId

    if (rawTenantId != null) {
      const tenantId = typeof rawTenantId === 'string'
        ? Number.parseInt(rawTenantId, 10)
        : Number(rawTenantId)

      if (Number.isInteger(tenantId) && tenantId > 0) {
        this.tenantContext.setTenantId(tenantId)
        request.tenantContext = this.tenantContext
      }
    }

    return next.handle()
  }
}
