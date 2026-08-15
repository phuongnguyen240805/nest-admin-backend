import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

export type AutomationOutboundDispatchStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'DEAD'
  | 'CANCELLED'

@Entity('lp_automation_outbound_dispatch')
@Index(['tenantId', 'dispatchId'], { unique: true })
@Index(['tenantId', 'idempotencyKey'], { unique: true })
@Index(['tenantId', 'status', 'availableAt'])
@Index(['tenantId', 'executionId'])
export class AutomationOutboundDispatchEntity extends TenantScopedEntity {
  @Column({ name: 'dispatch_id', type: 'uuid' })
  dispatchId: string

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string

  @Column({ name: 'execution_id', type: 'uuid' })
  executionId: string

  @Column({ name: 'node_id', type: 'varchar', length: 128 })
  nodeId: string

  @Column({ name: 'logical_iteration', type: 'int', default: 0 })
  logicalIteration: number

  @Column({ name: 'conversation_id', type: 'varchar', length: 220 })
  conversationId: string

  @Column({ name: 'client_message_id', type: 'uuid' })
  clientMessageId: string

  @Column({ name: 'message_type', type: 'varchar', length: 30, default: 'text' })
  messageType: string

  @Column({ type: 'text', default: '' })
  content: string

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachments: number[]

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: AutomationOutboundDispatchStatus

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number

  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  availableAt: Date

  @Column({ name: 'provider_message_id', type: 'varchar', length: 220, nullable: true })
  providerMessageId: string | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null
}
