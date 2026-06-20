import { Column, Entity, Index } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import type { CrmCustomFieldDataType, CrmCustomFieldTargetType } from './types'

@Entity('crm_custom_field_def')
@Index(['tenantId', 'targetType', 'fieldName'], { unique: true })
export class CrmCustomFieldDefEntity extends CrmScopedEntity {
  @Column({ name: 'target_type', type: 'varchar', length: 30, default: 'person' })
  targetType: CrmCustomFieldTargetType

  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string

  @Column({ name: 'data_type', type: 'varchar', length: 30, default: 'TEXT' })
  dataType: CrmCustomFieldDataType

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean
}