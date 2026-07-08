import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { LandingAiJobEntity } from './landing-ai-job.entity'

@Entity('lp_landing_ai_job_event')
@Index('idx_lp_landing_ai_job_event_job', ['jobId', 'createdAt'])
export class LandingAiJobEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string

  @Column({ type: 'text' })
  message: string

  @Column({ type: 'smallint', nullable: true })
  progress: number | null

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @ManyToOne(() => LandingAiJobEntity, (job) => job.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: LandingAiJobEntity
}