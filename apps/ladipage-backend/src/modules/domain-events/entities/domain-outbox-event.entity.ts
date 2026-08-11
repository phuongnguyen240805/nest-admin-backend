import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('domain_outbox_event')
@Index(['tenantId', 'status', 'availableAt'])
@Index(['tenantId', 'aggregateType', 'aggregateId', 'createdAt'])
@Index(['eventId'], { unique: true })
export class DomainOutboxEventEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'aggregate_type', type: 'varchar', length: 60 })
  aggregateType: string

  @Column({ name: 'aggregate_id', type: 'varchar', length: 220 })
  aggregateId: string

  @Column({ name: 'event_type', type: 'varchar', length: 120 })
  eventType: string

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string

  @Column({ type: 'int', default: 0 })
  attempts: number

  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  availableAt: Date

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
