import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { CrmObjectDefinitionEntity } from './object-definition.entity'
import type { CrmCustomFieldDataType } from './types'

@Entity('crm_field_definition')
@Index(['objectId', 'fieldSlug'], { unique: true })
export class CrmFieldDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'object_id', type: 'uuid' })
  objectId: string

  @Column({ name: 'field_slug', type: 'varchar', length: 100 })
  fieldSlug: string

  @Column({ type: 'varchar', length: 255 })
  label: string

  @Column({ name: 'data_type', type: 'varchar', length: 30, default: 'TEXT' })
  dataType: CrmCustomFieldDataType

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null

  @Column({ type: 'int', default: 0 })
  position: number

  @ManyToOne(() => CrmObjectDefinitionEntity, (obj) => obj.fields, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'object_id' })
  object?: CrmObjectDefinitionEntity
}