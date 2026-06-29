import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_flow')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'ownerId'])
@Index(['tenantId', 'storeId'])
export class FlowEntity extends TenantScopedEntity {
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

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255 })
  alias: string

  @Column({ type: 'varchar', length: 50 })
  status: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string | null

  @Column({ name: 'scope_type', type: 'varchar', length: 50, default: 'PRIVATE' })
  scopeType: string

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ name: 'is_sharing', type: 'boolean', default: false })
  isSharing: boolean

  @Column({ name: 'total_subscribe', type: 'int', default: 0 })
  totalSubscribe: number

  @Column({ name: 'flow_config_count', type: 'int', default: 0 })
  flowConfigCount: number

  @Column({ name: 'updated_last', type: 'timestamptz', nullable: true })
  updatedLast: Date | null

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: unknown[]

  @Column({ name: 'trigger_types', type: 'jsonb', default: () => "'[]'" })
  triggerTypes: unknown[]

  @Column({ name: 'integration_ids', type: 'jsonb', default: () => "'[]'" })
  integrationIds: unknown[]

  @Column({ name: 'scope_users', type: 'jsonb', default: () => "'[]'" })
  scopeUsers: unknown[]

  @Column({ name: 'scope_teams', type: 'jsonb', default: () => "'[]'" })
  scopeTeams: unknown[]

  @Column({ type: 'jsonb', nullable: true })
  graph: Record<string, unknown> | null
}
