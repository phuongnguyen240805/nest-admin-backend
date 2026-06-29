import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_broadcast')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'ownerId'])
@Index(['tenantId', 'storeId'])
export class BroadcastEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ name: 'store_id', type: 'varchar', length: 64 })
  storeId: string

  @Column({ name: 'owner_id', type: 'varchar', length: 64 })
  ownerId: string

  @Column({ name: 'creator_id', type: 'varchar', length: 64 })
  creatorId: string

  @Column({ name: 'sub_owner_id', type: 'varchar', length: 64, nullable: true })
  subOwnerId: string | null

  @Column({ name: 'flow_id', type: 'varchar', length: 64, nullable: true })
  flowId: string | null

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255 })
  alias: string

  @Column({ type: 'varchar', length: 50 })
  type: string

  @Column({ type: 'varchar', length: 50 })
  status: string

  @Column({ type: 'varchar', length: 20, nullable: true })
  version: string | null

  @Column({ name: 'scope_type', type: 'varchar', length: 50, default: 'PRIVATE' })
  scopeType: string

  @Column({ name: 'config_type', type: 'varchar', length: 50, nullable: true })
  configType: string | null

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ name: 'sent_date', type: 'timestamptz', nullable: true })
  sentDate: Date | null

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date | null

  @Column({ name: 'total_click', type: 'int', default: 0 })
  totalClick: number

  @Column({ name: 'total_delivery', type: 'int', default: 0 })
  totalDelivery: number

  @Column({ name: 'total_read', type: 'int', default: 0 })
  totalRead: number

  @Column({ name: 'total_send', type: 'int', default: 0 })
  totalSend: number

  @Column({ type: 'jsonb', default: () => "'[]'" })
  segments: unknown[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: unknown[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  conditions: unknown[]

  @Column({ name: 'scope_users', type: 'jsonb', default: () => "'[]'" })
  scopeUsers: unknown[]

  @Column({ name: 'scope_teams', type: 'jsonb', default: () => "'[]'" })
  scopeTeams: unknown[]

  @Column({ type: 'jsonb', default: () => "'{}'" })
  email: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'" })
  messenger: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'" })
  sms: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'" })
  zalo: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  operator: unknown | null

  @Column({ name: 'send_limit_option', type: 'jsonb', nullable: true })
  sendLimitOption: unknown | null
}
