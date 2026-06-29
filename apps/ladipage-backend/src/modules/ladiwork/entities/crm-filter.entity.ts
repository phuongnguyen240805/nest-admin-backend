import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_crm_filter')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'entity', 'keyName'])
export class CrmFilterEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'int' })
  externalId: number

  @Column({ type: 'varchar', length: 100 })
  entity: string

  @Column({ name: 'key_name', type: 'varchar', length: 100 })
  keyName: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ name: 'filter_type', type: 'varchar', length: 50 })
  filterType: string

  @Column({ type: 'varchar', length: 50 })
  visibility: string

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean

  @Column({ name: 'is_editable', type: 'boolean', default: false })
  isEditable: boolean

  @Column({ name: 'is_temporary', type: 'boolean', default: false })
  isTemporary: boolean

  @Column({ type: 'jsonb', default: () => "'{}'" })
  conditions: Record<string, unknown>

  @Column({ name: 'conditions_conditions', type: 'jsonb', default: () => "'[]'" })
  conditionsConditions: unknown[]

  @Column({ name: 'conditions_glue', type: 'varchar', length: 20, default: 'AND' })
  conditionsGlue: string
}
