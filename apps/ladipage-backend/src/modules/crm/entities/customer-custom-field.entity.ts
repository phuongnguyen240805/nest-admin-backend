import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '~/common/entities/tenant-scoped.entity'

import { CustomerCustomFieldDataType } from '../common/enums'

@Entity('lp_customer_custom_field')
@Index(['tenantId', 'fieldName'], { unique: true })
export class CustomerCustomFieldEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 100 })
  fieldName: string

  @Column({ type: 'varchar', length: 255 })
  displayName: string

  @Column({ type: 'varchar', length: 30, default: CustomerCustomFieldDataType.TEXT })
  dataType: CustomerCustomFieldDataType

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null
}