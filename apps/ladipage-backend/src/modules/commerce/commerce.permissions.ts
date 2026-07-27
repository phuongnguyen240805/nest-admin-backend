import { definePermission } from '@liora/nest-core/modules/auth/decorators/permission.decorator'

/**
 * Commerce RBAC permission keys (M0: free + RBAC, no tier gate — ADR-009).
 * Values are prefixed with `commerce:` by definePermission.
 * e.g. CommercePermissions.PRODUCT_WRITE === 'commerce:product:write'
 */
export const CommercePermissions = definePermission('commerce', {
  PRODUCT_READ: 'product:read',
  PRODUCT_WRITE: 'product:write',
  ORDER_READ: 'order:read',
  ORDER_REFUND: 'order:refund',
  PAGE_BIND: 'page:bind',
  STORE_MANAGE: 'store:manage',
} as const)
