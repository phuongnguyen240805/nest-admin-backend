import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import { CrmCompanyEntity } from './company.entity'
import { CrmPersonEntity } from './person.entity'
import { CrmPipelineEntity } from './pipeline.entity'
import { CrmPipelineStageEntity } from './pipeline-stage.entity'
import type { CrmCurrencyAmount } from './types'

@Entity('crm_opportunity')
@Index(['tenantId', 'stageId'])
export class CrmOpportunityEntity extends CrmScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'jsonb', nullable: true })
  amount: CrmCurrencyAmount | null

  @Column({ name: 'close_date', type: 'date', nullable: true })
  closeDate: string | null

  @Column({ name: 'pipeline_id', type: 'uuid' })
  pipelineId: string

  @Column({ name: 'stage_id', type: 'uuid' })
  stageId: string

  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId: string | null

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null

  @Column({ type: 'int', default: 0 })
  position: number

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  ownerId: number | null

  @ManyToOne(() => CrmPipelineEntity)
  @JoinColumn({ name: 'pipeline_id' })
  pipeline?: CrmPipelineEntity

  @ManyToOne(() => CrmPipelineStageEntity)
  @JoinColumn({ name: 'stage_id' })
  stage?: CrmPipelineStageEntity

  @ManyToOne(() => CrmPersonEntity)
  @JoinColumn({ name: 'person_id' })
  person?: CrmPersonEntity

  @ManyToOne(() => CrmCompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company?: CrmCompanyEntity

  @Column({
    name: 'search_vector',
    type: 'tsvector',
    select: false,
    nullable: true,
  })
  searchVector?: string | null
}