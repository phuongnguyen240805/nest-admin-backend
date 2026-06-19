import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_order_tag')
@Index(['tenantId', 'name'], { unique: true })
export class OrderTagEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string
}