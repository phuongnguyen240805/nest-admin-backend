import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('cc_ai_tool_call')
@Index(['tenantId', 'jobId', 'createdAt'])
export class CustomerCareAiToolCallEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'tenant_id', type: 'int' }) tenantId: number
  @Column({ name: 'job_id', type: 'uuid' }) jobId: string
  @Column({ name: 'conversation_id', type: 'uuid' }) conversationId: string
  @Column({ name: 'tool_name', type: 'varchar', length: 120 }) toolName: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) arguments: Record<string, unknown>
  @Column({ name: 'result_summary', type: 'jsonb', nullable: true }) resultSummary: Record<string, unknown> | null
  @Column({ name: 'result_hash', type: 'varchar', length: 64, nullable: true }) resultHash: string | null
  @Column({ type: 'varchar', length: 30 }) status: string
  @Column({ name: 'duration_ms', type: 'int' }) durationMs: number
  @Column({ type: 'text', nullable: true }) error: string | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date
}
