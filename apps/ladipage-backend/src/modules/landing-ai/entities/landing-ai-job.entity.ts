import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

import type { LandingAiJobStatus, LandingAiJobType } from '../queues/constants'
import { LandingAiJobEventEntity } from './landing-ai-job-event.entity'

@Entity('lp_landing_ai_job')
@Index('idx_lp_landing_ai_job_tenant', ['tenantId', 'createdAt'])
export class LandingAiJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId: string

  @Column({ name: 'page_id', type: 'uuid' })
  pageId: string

  @Column({ type: 'varchar', length: 20 })
  type: LandingAiJobType

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  status: LandingAiJobStatus

  @Column({ type: 'smallint', default: 0 })
  progress: number

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null

  @Column({ name: 'bull_job_id', type: 'varchar', length: 100, nullable: true })
  bullJobId: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @OneToMany(() => LandingAiJobEventEntity, (event) => event.job)
  events: LandingAiJobEventEntity[]
}