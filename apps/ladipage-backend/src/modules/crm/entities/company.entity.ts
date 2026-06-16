import { Column, Entity } from 'typeorm'

import { TenantScopedEntity } from '~/common/entities/tenant-scoped.entity'

@Entity('lp_company')
export class CompanyEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string
}