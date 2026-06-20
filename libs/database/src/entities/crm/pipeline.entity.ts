import { Column, Entity, Index, OneToMany } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import { CrmPipelineStageEntity } from './pipeline-stage.entity'

@Entity('crm_pipeline')
export class CrmPipelineEntity extends CrmScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ name: 'is_default', type: 'boolean', default: false })
  @Index()
  isDefault: boolean

  @OneToMany(() => CrmPipelineStageEntity, (stage) => stage.pipeline)
  stages?: CrmPipelineStageEntity[]
}