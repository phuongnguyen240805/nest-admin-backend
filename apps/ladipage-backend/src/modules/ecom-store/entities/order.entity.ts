import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import {
  OrderBusinessStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from '../common/enums'

@Entity('lp_order')
@Index(['tenantId', 'code'], { unique: true })
export class OrderEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 50 })
  code: string

  @Column({ type: 'int', nullable: true })
  customerId: number | null

  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId: string | null

  @Column({ type: 'varchar', length: 20, default: OrderStatus.PENDING })
  status: OrderStatus

  @Column({ name: 'business_status', type: 'varchar', length: 30, default: OrderBusinessStatus.CONFIRMED })
  businessStatus: OrderBusinessStatus

  @Column({ name: 'payment_status', type: 'varchar', length: 30, default: OrderPaymentStatus.UNKNOWN })
  paymentStatus: OrderPaymentStatus

  @Column({ name: 'fulfillment_status', type: 'varchar', length: 30, default: OrderFulfillmentStatus.UNFULFILLED })
  fulfillmentStatus: OrderFulfillmentStatus

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: number

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: number

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 14, scale: 2, default: 0 })
  shippingFee: number

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discount: number

  @Column({ name: 'shipping_payer', type: 'varchar', length: 20, default: 'customer' })
  shippingPayer: string

  @Column({ name: 'shipping_quote_id', type: 'int', nullable: true })
  shippingQuoteId: number | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string | null

  @Column({ name: 'assignee_id', type: 'varchar', length: 36, nullable: true })
  assigneeId: string | null

  @Column({ name: 'assignee_name', type: 'varchar', length: 255, nullable: true })
  assigneeName: string | null

  @Column({ type: 'varchar', length: 255 })
  customerName: string

  @Column({ type: 'varchar', length: 30 })
  customerPhone: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail: string | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @Column({ type: 'boolean', default: false })
  isIncomplete: boolean
}
