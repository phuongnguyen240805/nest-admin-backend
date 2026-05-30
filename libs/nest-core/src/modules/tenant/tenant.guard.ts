import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) { }

  canActivate(context: ExecutionContext): boolean {
    const tenantId = this.tenantContext.getTenantId();

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required. Please provide X-Tenant-ID header or valid JWT.');
    }

    return true;
  }
}