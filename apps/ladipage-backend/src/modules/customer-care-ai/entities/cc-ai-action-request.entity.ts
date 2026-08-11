import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('cc_ai_action_request')
@Index(['tenantId', 'conversationId', 'status'])
export class CustomerCareAiActionRequestEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'tenant_id', type: 'int' }) tenantId: number
  @Column({ name: 'conversation_id', type: 'uuid' }) conversationId: string
  @Column({ name: 'job_id', type: 'uuid', nullable: true }) jobId: string | null
  @Column({ name: 'action_type', type: 'varchar', length: 80 }) actionType: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) arguments: Record<string, unknown>
  @Column({ name: 'risk_level', type: 'varchar', length: 20, default: 'medium' }) riskLevel: string
  @Column({ name: 'policy_result', type: 'jsonb', default: () => "'{}'::jsonb" }) policyResult: Record<string, unknown>
  @Column({ type: 'varchar', length: 30, default: 'proposed' }) status: string
  @Column({ name: 'proposed_by_model', type: 'varchar', length: 160, nullable: true }) proposedByModel: string | null
  @Column({ name: 'approved_by', type: 'int', nullable: true }) approvedBy: number | null
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true }) approvedAt: Date | null
  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true }) executedAt: Date | null
  @Column({ name: 'execution_result', type: 'jsonb', nullable: true }) executionResult: Record<string, unknown> | null
  @Column({ name: 'idempotency_key', type: 'varchar', length: 120, nullable: true }) idempotencyKey: string | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date
}
