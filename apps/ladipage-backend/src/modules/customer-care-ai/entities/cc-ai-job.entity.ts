import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('cc_ai_job')
@Index(['tenantId', 'conversationId', 'createdAt'])
export class CustomerCareAiJobEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'tenant_id', type: 'int' }) tenantId: number
  @Column({ name: 'conversation_id', type: 'uuid' }) conversationId: string
  @Column({ name: 'trigger_message_id', type: 'varchar', length: 220, nullable: true }) triggerMessageId: string | null
  @Column({ name: 'job_type', type: 'varchar', length: 40 }) jobType: string
  @Column({ type: 'varchar', length: 30, default: 'queued' }) status: string
  @Column({ type: 'int', default: 10 }) priority: number
  @Column({ type: 'int', default: 0 }) attempts: number
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt: Date | null
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null
  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true }) errorCode: string | null
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date
}
