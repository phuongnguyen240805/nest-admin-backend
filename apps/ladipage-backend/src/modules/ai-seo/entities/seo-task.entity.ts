import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { SeoProjectEntity } from './seo-project.entity'

export type SeoTaskType = 'AUDIT' | 'KEYWORD' | 'DEPLOY'
export type SeoTaskStatus = 'pending' | 'approved' | 'rejected' | 'deployed'

@Entity('lp_seo_task')
@Index('idx_lp_seo_task_project', ['seoProjectId'])
@Index('idx_lp_seo_task_external', ['externalTaskId'])
export class SeoTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'seo_project_id', type: 'uuid' })
  seoProjectId: string

  @Column({ name: 'external_task_id', type: 'varchar', length: 128, nullable: true })
  externalTaskId: string | null

  @Column({ type: 'varchar', length: 30 })
  type: SeoTaskType

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: SeoTaskStatus

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'" })
  result: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @ManyToOne(() => SeoProjectEntity, (project) => project.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seo_project_id' })
  project: SeoProjectEntity
}
