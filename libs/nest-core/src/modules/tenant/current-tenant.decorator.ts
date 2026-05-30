import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

export const CurrentTenant = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const tenantContext = request.tenantContext as TenantContextService;
        return tenantContext?.getCurrentTenant() || null;
    },
);