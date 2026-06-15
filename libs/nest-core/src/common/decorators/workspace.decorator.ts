import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @Workspace() decorator
 *
 * Extracts the current workspaceId (multi-tenant identifier) from the request.
 * 
 * This is **extremely important** for LadiPage and all future modules.
 * It is populated by:
 *   - TenantInterceptor / TenantGuard
 *   - JWT payload containing `workspaceId` or `organizationId`
 *   - Or custom middleware
 *
 * Usage:
 *   @Post()
 *   create(@Workspace() workspaceId: string, @Body() dto: CreateDto) {
 *     return this.service.create(dto, workspaceId);
 *   }
 *
 * Prefer using this decorator + passing workspaceId explicitly to services
 * rather than relying on cls or async hooks for clarity and testability.
 */
export const Workspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // Support multiple possible keys that may be set by auth/tenant layer
    return (
      request.workspaceId ||
      request.organization ||
      request.user?.workspaceId ||
      request.user?.organizationId ||
      request.user?.orgId
    );
  },
);
