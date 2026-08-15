import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_automation_sequence_dispatch')
@Index(['tenantId', 'dispatchId'], { unique: true })
@Index(['tenantId', 'idempotencyKey'], { unique: true })
@Index(['tenantId', 'status', 'runAt'])
@Index(['tenantId', 'enrollmentId'])
export class AutomationSequenceDispatchEntity extends TenantScopedEntity {
  @Column({ name: 'dispatch_id', type: 'uuid' })
  dispatchId: string

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string

  @Column({ name: 'sequence_id', type: 'varchar', length: 64 })
  sequenceExternalId: string

  @Column({ name: 'step_id', type: 'varchar', length: 64 })
  stepExternalId: string

  @Column({ name: 'run_at', type: 'timestamptz' })
  runAt: Date

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: string

  @Column({ type: 'int', default: 0 })
  attempts: number

  @Column({ name: 'flow_execution_id', type: 'uuid', nullable: true })
  flowExecutionId: string | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null
}
