import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

export type CrmIdMapEntityType = 'person' | 'company' | 'custom_field_def'

@Entity('crm_id_map')
@Index(['tenantId', 'entityType', 'legacyId'], { unique: true })
export class CrmIdMapEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'int' })
  tenantId: number

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: CrmIdMapEntityType

  @Column({ name: 'legacy_id', type: 'int' })
  legacyId: number

  @Column({ name: 'crm_id', type: 'uuid' })
  crmId: string
}