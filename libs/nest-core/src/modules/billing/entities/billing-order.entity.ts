import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { Organization } from './organization.entity'
import { Period, SubscriptionTier } from './subscription.entity'

export enum BillingOrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYOS = 'payos',
}

@Entity('billing_order')
@Index(['organizationId'])
@Index(['status'])
export class BillingOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'int' })
  tenantId: number

  @Column({ type: 'uuid' })
  organizationId: string

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  @Column({ type: 'bigint', unique: true })
  orderCode: string

  @Column({ type: 'varchar', length: 20, default: PaymentProvider.PAYOS })
  paymentProvider: PaymentProvider

  @Column({ type: 'varchar', length: 20 })
  planTier: SubscriptionTier

  @Column({ type: 'varchar', length: 20 })
  period: Period

  @Column({ type: 'int' })
  amountVnd: number

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string

  @Column({ type: 'varchar', length: 20, default: BillingOrderStatus.PENDING })
  status: BillingOrderStatus

  @Column({ type: 'varchar', length: 64, nullable: true })
  payosPaymentLinkId?: string

  @Column({ type: 'text', nullable: true })
  payosCheckoutUrl?: string

  @Column({ type: 'text', nullable: true })
  payosQrCode?: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date

  @Column({ type: 'varchar', length: 128, nullable: true })
  webhookEventId?: string

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date
}