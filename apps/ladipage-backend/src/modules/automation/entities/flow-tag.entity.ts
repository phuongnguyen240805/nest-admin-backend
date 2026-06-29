import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_flow_tag')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'ownerId'])
@Index(['tenantId', 'storeId'])
export class FlowTagEntity extends TenantScopedEntity {
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

  @Column({ type: 'int', default: 0 })
  total: number

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ type: 'boolean', default: true })
  status: boolean
}
