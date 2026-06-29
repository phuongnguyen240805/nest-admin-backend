import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_integration')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'ownerId'])
@Index(['tenantId', 'storeId'])
export class IntegrationEntity extends TenantScopedEntity {
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

  @Column({ type: 'boolean', default: true })
  status: boolean

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean

  @Column({ name: 'scope_type', type: 'varchar', length: 50, default: 'PRIVATE' })
  scopeType: string

  @Column({ name: 'scope_users', type: 'jsonb', default: () => "'[]'" })
  scopeUsers: unknown[]

  @Column({ name: 'scope_teams', type: 'jsonb', default: () => "'[]'" })
  scopeTeams: unknown[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: unknown[]

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config: Record<string, unknown>

  @Column({ name: 'config__id', type: 'varchar', length: 64, nullable: true })
  configId: string | null

  @Column({ name: 'config_api_key', type: 'varchar', length: 255, nullable: true })
  configApiKey: string | null

  @Column({ name: 'config_refresh_token', type: 'varchar', length: 255, nullable: true })
  configRefreshToken: string | null
}
