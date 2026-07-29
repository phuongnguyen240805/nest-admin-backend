import { definePermission } from '@liora/nest-core/modules/auth/decorators/permission.decorator'

/**
 * Cloud Phone RBAC permission keys.
 * Values are prefixed with `cloudphone:` by definePermission.
 * e.g. CloudPhonePermissions.DEVICE_READ === 'cloudphone:device:read'
 */
export const CloudPhonePermissions = definePermission('cloudphone', {
  DEVICE_READ: 'device:read',
  BOOKING_READ: 'booking:read',
  BOOKING_WRITE: 'booking:write',
  SESSION_CONTROL: 'session:control',
} as const)
