import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('domain_event_delivery')
@Index(['eventId', 'consumer'], { unique: true })
@Index(['tenantId', 'consumer', 'status', 'createdAt'])
export class DomainEventDeliveryEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ type: 'varchar', length: 80 })
  consumer: string

  @Column({ type: 'varchar', length: 30, default: 'observed' })
  status: string

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>

  @Column({ name: 'observed_at', type: 'timestamptz', nullable: true })
  observedAt: Date | null

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
