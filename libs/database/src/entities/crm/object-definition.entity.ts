import { Column, Entity, Index, OneToMany } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import { CrmFieldDefinitionEntity } from './field-definition.entity'

@Entity('crm_object_definition')
@Index(['tenantId', 'slug'], { unique: true, where: '"deleted_at" IS NULL' })
export class CrmObjectDefinitionEntity extends CrmScopedEntity {
  @Column({ type: 'varchar', length: 100 })
  slug: string

  @Column({ type: 'varchar', length: 255 })
  label: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @OneToMany(() => CrmFieldDefinitionEntity, (field) => field.object)
  fields?: CrmFieldDefinitionEntity[]
}