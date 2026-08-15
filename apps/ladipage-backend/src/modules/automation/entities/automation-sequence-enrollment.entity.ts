import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_automation_sequence_enrollment')
@Index(['tenantId', 'enrollmentId'], { unique: true })
@Index(['tenantId', 'sequenceExternalId', 'conversationId'], { unique: true, where: `"status" = 'ACTIVE'` })
@Index(['tenantId', 'status', 'nextRunAt'])
export class AutomationSequenceEnrollmentEntity extends TenantScopedEntity {
  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string

  @Column({ name: 'sequence_id', type: 'varchar', length: 64 })
  sequenceExternalId: string

  @Column({ name: 'contact_identity_id', type: 'int', nullable: true })
  contactIdentityId: number | null

  @Column({ name: 'conversation_id', type: 'varchar', length: 220 })
  conversationId: string

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string

  @Column({ name: 'current_order', type: 'int', default: -1 })
  currentOrder: number

  @Column({ name: 'last_step_id', type: 'varchar', length: 64, nullable: true })
  lastStepId: string | null

  @Column({ name: 'next_step_id', type: 'varchar', length: 64, nullable: true })
  nextStepId: string | null

  @Column({ name: 'next_run_at', type: 'timestamptz', nullable: true })
  nextRunAt: Date | null

  @Column({ name: 'enrolled_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  enrolledAt: Date

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null
}
