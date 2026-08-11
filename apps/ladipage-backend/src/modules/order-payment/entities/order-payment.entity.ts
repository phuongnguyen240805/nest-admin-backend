import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import { OrderPaymentStatus } from '../../ecom-store/common/enums'

@Entity('lp_order_payment')
@Index(['tenantId', 'orderId'])
@Index(['tenantId', 'orderId', 'provider'], { unique: true, where: "status IN ('PENDING', 'COD_PENDING')" })
@Index(['referenceCode'], { unique: true, where: 'reference_code IS NOT NULL' })
@Index(['tenantId', 'idempotencyKey'], { unique: true, where: 'idempotency_key IS NOT NULL' })
@Index(['provider', 'providerTransactionId'], { unique: true, where: 'provider_transaction_id IS NOT NULL' })
export class OrderPaymentEntity extends TenantScopedEntity {
  @Column({ name: 'order_id', type: 'int' })
  orderId: number

  @Column({ type: 'varchar', length: 30 })
  provider: string

  @Column({ type: 'varchar', length: 40 })
  method: string

  @Column({ type: 'varchar', length: 30, default: OrderPaymentStatus.PENDING })
  status: OrderPaymentStatus

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string

  @Column({ name: 'reference_code', type: 'varchar', length: 80, nullable: true })
  referenceCode: string | null

  @Column({ name: 'provider_transaction_id', type: 'varchar', length: 120, nullable: true })
  providerTransactionId: string | null

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120, nullable: true })
  idempotencyKey: string | null

  @Column({ name: 'qr_url', type: 'text', nullable: true })
  qrUrl: string | null

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: true })
  expiredAt: Date | null

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>
}
