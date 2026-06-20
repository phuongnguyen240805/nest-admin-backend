import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import { CrmObjectDefinitionEntity } from './object-definition.entity'

@Entity('crm_dynamic_record')
@Index(['tenantId', 'objectId'])
export class CrmDynamicRecordEntity extends CrmScopedEntity {
  @Column({ name: 'object_id', type: 'uuid' })
  objectId: string

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, unknown>

  @Column({
    name: 'search_vector',
    type: 'tsvector',
    select: false,
    nullable: true,
  })
  searchVector?: string | null

  @ManyToOne(() => CrmObjectDefinitionEntity)
  @JoinColumn({ name: 'object_id' })
  object?: CrmObjectDefinitionEntity
}