import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '~/common/entities/tenant-scoped.entity'

@Entity('lp_customer_tag')
@Index(['tenantId', 'name'], { unique: true })
export class CustomerTagEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string
}