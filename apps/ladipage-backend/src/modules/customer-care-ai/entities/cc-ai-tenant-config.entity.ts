import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('cc_ai_tenant_config')
@Index(['tenantId'], { unique: true })
export class CustomerCareAiTenantConfigEntity {
  @PrimaryGeneratedColumn() id: number
  @Column({ name: 'tenant_id', type: 'int' }) tenantId: number
  @Column({ type: 'boolean', default: true }) enabled: boolean
  @Column({ type: 'varchar', length: 30, default: 'copilot' }) mode: string
  @Column({ type: 'varchar', length: 160, nullable: true }) model: string | null
  @Column({ type: 'double precision', default: 0.2 }) temperature: number
  @Column({ name: 'max_output_tokens', type: 'int', default: 1200 }) maxOutputTokens: number
  @Column({ name: 'prompt_version', type: 'varchar', length: 80, default: 'cc-v1' }) promptVersion: string
  @Column({ name: 'daily_budget', type: 'decimal', precision: 14, scale: 4, nullable: true }) dailyBudget: number | null
  @Column({ name: 'auto_reply_enabled', type: 'boolean', default: false }) autoReplyEnabled: boolean
  @Column({ name: 'auto_action_enabled', type: 'boolean', default: false }) autoActionEnabled: boolean
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date
}
