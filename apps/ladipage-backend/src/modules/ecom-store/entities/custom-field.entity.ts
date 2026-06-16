import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '~/common/entities/tenant-scoped.entity'

import { CustomFieldDataType, EcomEntityType } from '../common/enums'

@Entity('lp_custom_field')
@Index(['tenantId', 'entityType', 'fieldName'], { unique: true })
export class CustomFieldEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 20 })
  entityType: EcomEntityType

  @Column({ type: 'varchar', length: 100 })
  fieldName: string

  @Column({ type: 'varchar', length: 255 })
  displayName: string

  @Column({ type: 'varchar', length: 30, default: CustomFieldDataType.TEXT })
  dataType: CustomFieldDataType

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null
}