import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '~/common/entities/tenant-scoped.entity'

import { CustomerStatus } from '../common/enums'

@Entity('lp_customer')
@Index(['tenantId', 'phone'])
@Index(['tenantId', 'email'])
export class CustomerEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 30 })
  phone: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null

  @Column({ type: 'varchar', length: 20, default: CustomerStatus.ACTIVE })
  status: CustomerStatus
}