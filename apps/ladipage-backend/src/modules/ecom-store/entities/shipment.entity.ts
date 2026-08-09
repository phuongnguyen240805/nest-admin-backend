import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import type { ShippingProvider } from './shipping-integration.entity'

@Entity('lp_shipment')
@Index(['tenantId', 'orderId'], { unique: true })
@Index(['tenantId', 'trackingCode'])
export class ShipmentEntity extends TenantScopedEntity {
  @Column({ type: 'int' })
  orderId: number

  @Column({ type: 'int' })
  integrationId: number

  @Column({ type: 'varchar', length: 20 })
  provider: ShippingProvider

  @Column({ type: 'varchar', length: 120, nullable: true })
  trackingCode: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerOrderId: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  idempotencyKey: string | null

  @Column({ type: 'varchar', length: 80, nullable: true })
  serviceCode: string | null

  @Column({ type: 'varchar', length: 150, nullable: true })
  serviceName: string | null

  @Column({ type: 'varchar', length: 50, default: 'CREATED' })
  status: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  providerStatus: string | null

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  fee: number

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  codAmount: number

  @Column({ type: 'varchar', length: 255 })
  recipientName: string

  @Column({ type: 'varchar', length: 30 })
  recipientPhone: string

  @Column({ type: 'text' })
  address: string

  @Column({ type: 'varchar', length: 120, nullable: true })
  province: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  district: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  ward: string | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  providerPayload: Record<string, unknown>

  @Column({ type: 'timestamptz', nullable: true })
  lastTrackedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  estimatedDeliveryAt: Date | null
}
