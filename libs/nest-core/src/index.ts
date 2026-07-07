/**
 * Barrel file chính của nest-core library
 * Export tất cả những gì bên ngoài cần dùng
 */

// Common utilities (Foundation & Shared - Giai đoạn 1)
export * from './common';

// Convenience re-exports for the most used foundation pieces
export { BaseEntity } from './common/entities/base.entity';
export { BaseService } from './common/services/base.service';
export { CurrentUser, Workspace } from './common/decorators';
export {
  PaginationDto,
  FilterDto,
  ResponseDto,
  ErrorResponseDto,
  IdParamDto,
} from './common/dto';

// Config
export * from './config';

// Constants
export * from './constants';

// Global env
export * from './global';

// Helper & Utils
export * from './helper';
export * from './utils';

// Socket
export * from './socket';

// Modules chính (export tất cả module để ngoài dùng được)
export * from './shared/shared.module';
export * from './socket/socket.module';

export * from './modules/auth/auth.module';
export { Public } from './modules/auth/decorators/public.decorator';
export * from './modules/auth/guards/jwt-auth.guard';
export * from './modules/auth/guards/rbac.guard';
export * from './modules/system/system.module';
export * from './modules/user/user.module';
export * from './modules/tools/tools.module';
// Re-export các sub-modules hữu ích để app khác (như ladipage-backend) import trực tiếp
export * from './modules/tools/upload/upload.module';
export * from './modules/tools/storage/storage.module';
export * from './modules/tools/email/email.module';

export * from './modules/todo/todo.module';
export * from './modules/netdisk/netdisk.module';
export * from './modules/tasks/tasks.module';
export * from './modules/sse/sse.module';
export * from './modules/agent/agent.module';
export * from './modules/billing/billing.module';
export { PlanConfigService } from './modules/billing/config/plan.config';
export * from './modules/tenant/tenant.module';
export { Tenant } from './modules/tenant/entities/tenant.entity';
export { TenantContextService } from './modules/tenant/tenant-context.service';
export { TenantGuard } from './modules/tenant/tenant.guard';
/** @deprecated Use TenantGuard — alias kept for existing ladipage imports */
export { TenantGuard as TenantContextGuard } from './modules/tenant/tenant.guard';
export { OrganizationProvisioningService } from './modules/tenant/organization-provisioning.service';
export { AppMembershipService } from './modules/tenant/app-membership.service';
export {
  APP_CODE_LADIPAGE,
  APP_CODE_NEST_ADMIN,
  LEGACY_DEFAULT_APP_CODE,
} from './modules/tenant/constants/app-scope.constant';
export { GetOrgFromRequest } from './common/decorators/get-org-from-request.decorator';
export * from './modules/public-api/public-api.module';
export * from './modules/health/health.module';

// Một số entity hay dùng trực tiếp
export * from './modules/system/menu/menu.entity';
export * from './modules/system/role/role.entity';
export * from './modules/system/dept/dept.entity';
// export thêm entity khác khi cần

// Re-export một số type quan trọng
export type * from './config';
