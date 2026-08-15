import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

export type FlowExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'WAITING_REPLY'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

@Entity('lp_flow_execution')
@Index(['tenantId', 'executionId'], { unique: true })
@Index(['tenantId', 'flowExternalId', 'status'])
@Index(['tenantId', 'conversationId', 'status'])
@Index(['tenantId', 'triggerEventId', 'triggerId', 'flowExternalId'], { unique: true })
export class FlowExecutionEntity extends TenantScopedEntity {
  @Column({ name: 'execution_id', type: 'uuid' })
  executionId: string

  @Column({ name: 'flow_external_id', type: 'varchar', length: 64 })
  flowExternalId: string

  @Column({ name: 'conversation_id', type: 'varchar', length: 220, nullable: true })
  conversationId: string | null

  @Column({ name: 'contact_id', type: 'varchar', length: 220, nullable: true })
  contactId: string | null

  @Column({ name: 'trigger_id', type: 'varchar', length: 64, nullable: true })
  triggerId: string | null

  @Column({ name: 'trigger_event_id', type: 'uuid', nullable: true })
  triggerEventId: string | null

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: FlowExecutionStatus

  @Column({ name: 'current_node_id', type: 'varchar', length: 128, nullable: true })
  currentNodeId: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  context: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  variables: Record<string, unknown>

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null

  @Column({ name: 'waiting_until', type: 'timestamptz', nullable: true })
  waitingUntil: Date | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @Column({ name: 'lock_token', type: 'uuid', nullable: true })
  lockToken: string | null

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null

  @Column({ type: 'int', default: 1 })
  version: number
}
