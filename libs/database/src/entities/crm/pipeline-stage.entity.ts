import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { CrmPipelineEntity } from './pipeline.entity'

@Entity('crm_pipeline_stage')
@Index(['pipelineId', 'position'])
export class CrmPipelineStageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'pipeline_id', type: 'uuid' })
  pipelineId: string

  @Column({ type: 'varchar', length: 100 })
  slug: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'int', default: 0 })
  position: number

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null

  @ManyToOne(() => CrmPipelineEntity, (pipeline) => pipeline.stages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pipeline_id' })
  pipeline?: CrmPipelineEntity
}