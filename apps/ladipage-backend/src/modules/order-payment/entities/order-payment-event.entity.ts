import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_order_payment_event')
@Index(['tenantId', 'paymentId', 'createdAt'])
export class OrderPaymentEventEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'payment_id', type: 'int' })
  paymentId: number

  @Column({ type: 'varchar', length: 80 })
  type: string

  @Column({ type: 'varchar', length: 30 })
  status: string

  @Column({ name: 'provider_event_id', type: 'varchar', length: 120, nullable: true })
  providerEventId: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
