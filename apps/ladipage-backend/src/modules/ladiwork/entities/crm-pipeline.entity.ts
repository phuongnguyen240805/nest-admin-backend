import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_crm_pipeline')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'ownerId'])
@Index(['tenantId', 'storeId'])
export class CrmPipelineEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ name: 'store_id', type: 'varchar', length: 64 })
  storeId: string

  @Column({ name: 'owner_id', type: 'varchar', length: 64 })
  ownerId: string

  @Column({ name: 'creator_id', type: 'varchar', length: 64 })
  creatorId: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255 })
  alias: string

  @Column({ type: 'varchar', length: 50 })
  type: string

  @Column({ name: 'scope_type', type: 'varchar', length: 50, default: 'PRIVATE' })
  scopeType: string

  @Column({ name: 'pipeline_category_id', type: 'varchar', length: 64, nullable: true })
  pipelineCategoryId: string | null

  @Column({ name: 'category_id', type: 'varchar', length: 64, nullable: true })
  categoryId: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null

  @Column({ type: 'int', default: 0 })
  count: number

  @Column({ name: 'deal_probability', type: 'boolean', default: false })
  dealProbability: boolean

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ name: 'privacy_mode', type: 'boolean', default: false })
  privacyMode: boolean

  @Column({ type: 'boolean', default: false })
  notification: boolean

  @Column({ name: 'timer_notification', type: 'varchar', length: 100, nullable: true })
  timerNotification: string | null

  @Column({ name: 'unit_notification', type: 'varchar', length: 30, default: 'MONTH' })
  unitNotification: string

  @Column({ name: 'next_time_check_notification_deal_delayer', type: 'timestamptz', nullable: true })
  nextTimeCheckNotificationDealDelayer: Date | null

  @Column({ type: 'jsonb', default: () => "'[]'" })
  stages: unknown[]

  @Column({ name: 'custom_fields', type: 'jsonb', default: () => "'[]'" })
  customFields: unknown[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  pipelines: unknown[]

  @Column({ name: 'prioritize_ladiuid', type: 'jsonb', default: () => "'[]'" })
  prioritizeLadiuid: unknown[]

  @Column({ name: 'scope_users', type: 'jsonb', default: () => "'[]'" })
  scopeUsers: unknown[]

  @Column({ name: 'scope_object_users', type: 'jsonb', default: () => "'[]'" })
  scopeObjectUsers: unknown[]

  @Column({ name: 'scope_teams', type: 'jsonb', default: () => "'[]'" })
  scopeTeams: unknown[]
}
