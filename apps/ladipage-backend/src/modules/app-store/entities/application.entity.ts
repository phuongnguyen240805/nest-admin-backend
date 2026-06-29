import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_application')
@Index(['tenantId', 'storeId', 'code'], { unique: true })
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'ownerId'])
export class ApplicationEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ name: 'store_id', type: 'varchar', length: 64 })
  storeId: string

  @Column({ name: 'owner_id', type: 'varchar', length: 64 })
  ownerId: string

  @Column({ name: 'ladi_uid', type: 'varchar', length: 64 })
  ladiUid: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 100 })
  code: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumb: string | null

  @Column({ type: 'int', default: 0 })
  price: number

  @Column({ name: 'status_active', type: 'boolean', default: false })
  statusActive: boolean

  @Column({ name: 'status_actived_at', type: 'timestamptz', nullable: true })
  statusActivedAt: Date | null

  @Column({ name: 'status_pin', type: 'boolean', default: false })
  statusPin: boolean

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean
}
