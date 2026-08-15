import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_automation_sequence_step')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'sequenceExternalId', 'order'], { unique: true })
export class AutomationSequenceStepEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ name: 'sequence_id', type: 'varchar', length: 64 })
  sequenceExternalId: string

  @Column({ name: 'flow_id', type: 'varchar', length: 64 })
  flowExternalId: string

  @Column({ type: 'int' })
  order: number

  @Column({ name: 'delay_days', type: 'int', default: 0 })
  delayDays: number

  @Column({ name: 'delay_minutes', type: 'int', default: 0 })
  delayMinutes: number

  @Column({ name: 'specific_date_time', type: 'timestamptz', nullable: true })
  specificDateTime: Date | null

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean

  @Column({ type: 'boolean', default: true })
  anytime: boolean

  @Column({ name: 'send_time_start', type: 'varchar', length: 5, nullable: true })
  sendTimeStart: string | null

  @Column({ name: 'send_time_end', type: 'varchar', length: 5, nullable: true })
  sendTimeEnd: string | null

  @Column({ name: 'send_days', type: 'jsonb', default: () => `'["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'::jsonb` })
  sendDays: string[]
}
