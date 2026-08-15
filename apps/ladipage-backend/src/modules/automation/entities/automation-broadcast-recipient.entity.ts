import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_automation_broadcast_recipient')
@Index(['tenantId', 'recipientId'], { unique: true })
@Index(['tenantId', 'broadcastExternalId', 'conversationId'], { unique: true })
@Index(['tenantId', 'broadcastExternalId', 'status'])
export class AutomationBroadcastRecipientEntity extends TenantScopedEntity {
  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string

  @Column({ name: 'broadcast_id', type: 'varchar', length: 64 })
  broadcastExternalId: string

  @Column({ name: 'contact_identity_id', type: 'int', nullable: true })
  contactIdentityId: number | null

  @Column({ name: 'conversation_id', type: 'varchar', length: 220 })
  conversationId: string

  @Column({ name: 'channel_account_id', type: 'int' })
  channelAccountId: number

  @Column({ type: 'varchar', length: 40 })
  provider: string

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: string

  @Column({ name: 'flow_execution_id', type: 'uuid', nullable: true })
  flowExecutionId: string | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null
}
