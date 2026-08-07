import { definePermission } from '@liora/nest-core/modules/auth/decorators/permission.decorator'

export const CustomerCarePermissions = definePermission('customer-care', {
  CONVERSATION_READ: 'conversation:read',
  CONVERSATION_WRITE: 'conversation:write',
  MESSAGE_SEND: 'message:send',
  ASSIGN: 'assign',
  CONTACT_UPDATE: 'contact:update',
  CHANNEL_READ: 'channel:read',
  CHANNEL_MANAGE: 'channel:manage',
} as const)
