import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('lp_payment_webhook_event')
@Index(['provider', 'providerEventId'], { unique: true })
export class SepayWebhookEventEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'tenant_id', type: 'int', nullable: true })
  tenantId: number | null

  @Column({ name: 'payment_id', type: 'int', nullable: true })
  paymentId: number | null

  @Column({ type: 'varchar', length: 30, default: 'sepay' })
  provider: string

  @Column({ name: 'provider_event_id', type: 'varchar', length: 120 })
  providerEventId: string

  @Column({ type: 'varchar', length: 30, default: 'received' })
  status: string

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
