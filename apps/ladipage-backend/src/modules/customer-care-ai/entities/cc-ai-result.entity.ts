import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('cc_ai_result')
@Index(['tenantId', 'conversationId', 'createdAt'])
export class CustomerCareAiResultEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'job_id', type: 'uuid' }) jobId: string
  @Column({ name: 'tenant_id', type: 'int' }) tenantId: number
  @Column({ name: 'conversation_id', type: 'uuid' }) conversationId: string
  @Column({ name: 'result_type', type: 'varchar', length: 40 }) resultType: string
  @Column({ type: 'text' }) content: string
  @Column({ name: 'structured_result', type: 'jsonb', default: () => "'{}'::jsonb" }) structuredResult: Record<string, unknown>
  @Column({ type: 'varchar', length: 160, nullable: true }) model: string | null
  @Column({ type: 'varchar', length: 60, nullable: true }) gateway: string | null
  @Column({ name: 'prompt_version', type: 'varchar', length: 80 }) promptVersion: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) usage: Record<string, unknown>
  @Column({ name: 'latency_ms', type: 'int', nullable: true }) latencyMs: number | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date
}
