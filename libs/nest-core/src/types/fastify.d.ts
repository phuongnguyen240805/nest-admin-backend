import type { FastifyRequest } from 'fastify';
import type { IAuthUser } from '../modules/auth/interfaces/auth.interface';
import type { Organization } from '../modules/billing/entities/organization.entity';
import type { TenantContextService } from '../modules/tenant/tenant-context.service';

declare module 'fastify' {
  interface FastifyRequest {
    user?: IAuthUser;
    accessToken?: string;
    /** Loaded Organization entity (set by TenantInterceptor) */
    org?: Organization;
    /** Organization UUID string for TenantGuard */
    organization?: string;
    tenantId?: number;
    tenantContext?: TenantContextService;
  }
}