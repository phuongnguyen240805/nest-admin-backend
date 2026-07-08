import { ForbiddenException } from '@nestjs/common'

import type { RpcContext } from '../ladipage-rpc/rpc-dispatcher.service'

export function resolveAppStoreTenantId(ctx: RpcContext): number {
  const tenantId = ctx.tenantId ?? ctx.user?.activeTenantId ?? ctx.user?.tenantId
  if (tenantId == null) {
    throw new ForbiddenException('Tenant context is required for app store access.')
  }
  return tenantId
}

export function resolveAppStoreOwnerId(ctx: RpcContext): string {
  if (ctx.user?.uid == null) {
    throw new ForbiddenException('User context is required for app store access.')
  }
  return String(ctx.user.uid)
}

export function buildAppStoreScopeKey(tenantId: number, ownerId: string, storeId?: string): string {
  return `${tenantId}:${ownerId}:${storeId ?? 'default'}`
}