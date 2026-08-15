import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

export type AutomationActionDispatchStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD'
  | 'CANCELLED'

@Entity('lp_automation_action_dispatch')
@Index(['tenantId', 'dispatchId'], { unique: true })
@Index(['tenantId', 'idempotencyKey'], { unique: true })
@Index(['tenantId', 'status', 'availableAt'])
@Index(['tenantId', 'executionId'])
export class AutomationActionDispatchEntity extends TenantScopedEntity {
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

  @Column({ name: 'conversation_id', type: 'varchar', length: 220, nullable: true })
  conversationId: string | null

  @Column({ name: 'action_type', type: 'varchar', length: 80 })
  actionType: string

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  result: Record<string, unknown>

  @Column({ name: 'result_variable', type: 'varchar', length: 128, nullable: true })
  resultVariable: string | null

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: AutomationActionDispatchStatus

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number

  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  availableAt: Date

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null
}
