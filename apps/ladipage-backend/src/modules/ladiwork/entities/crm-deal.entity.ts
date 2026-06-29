import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_crm_deal')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'pipelineId', 'pipelineStageId'])
export class CrmDealEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ name: 'pipeline_id', type: 'varchar', length: 64 })
  pipelineId: string

  @Column({ name: 'pipeline_stage_id', type: 'varchar', length: 64 })
  pipelineStageId: string

  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'varchar', length: 30, default: 'OPEN' })
  status: string

  @Column({ type: 'int', default: 0 })
  position: number

  @Column({ name: 'total_value', type: 'int', default: 0 })
  totalValue: number

  @Column({ name: 'weighted_value', type: 'int', default: 0 })
  weightedValue: number

  @Column({ type: 'int', default: 0 })
  priority: number

  @Column({ name: 'activity_status', type: 'varchar', length: 50, nullable: true })
  activityStatus: string | null

  @Column({ name: 'expected_close_date', type: 'timestamptz', nullable: true })
  expectedCloseDate: Date | null

  @Column({ name: 'customer_id', type: 'varchar', length: 64, nullable: true })
  customerId: string | null

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName: string | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  customer: Record<string, unknown>

  @Column({ name: 'identity_id', type: 'int', nullable: true })
  identityId: number | null

  @Column({ name: 'stage_probability', type: 'int', default: 0 })
  stageProbability: number

  @Column({ name: 'final_probability', type: 'int', default: 0 })
  finalProbability: number

  @Column({ name: 'total_deal_notes', type: 'int', default: 0 })
  totalDealNotes: number

  @Column({ type: 'jsonb', default: () => "'[]'" })
  labels: unknown[]

  @Column({ name: 'scope_users', type: 'jsonb', default: () => "'[]'" })
  scopeUsers: unknown[]
}
