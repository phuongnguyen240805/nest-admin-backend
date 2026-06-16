import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
    constructor(private readonly tenantContext: TenantContextService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const rawTenantId =
            request.headers['x-tenant-id'] ||
            request.user?.activeTenantId ||
            request.user?.tenantId ||
            request.query?.tenantId;

        if (rawTenantId != null) {
            const tenantId = typeof rawTenantId === 'string'
                ? Number.parseInt(rawTenantId, 10)
                : Number(rawTenantId);

            if (!Number.isNaN(tenantId)) {
                this.tenantContext.setTenantId(tenantId);
                request.tenantContext = this.tenantContext;
            }
        }

        return next.handle();
    }
}