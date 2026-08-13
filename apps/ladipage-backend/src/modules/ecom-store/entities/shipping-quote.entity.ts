import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import type { ShippingProvider } from '../shipping/core'

@Entity('lp_shipping_quote')
@Index(['tenantId', 'expiresAt'])
export class ShippingQuoteEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 20 })
  provider: ShippingProvider

  @Column({ type: 'varchar', length: 80, nullable: true })
  serviceCode: string | null

  @Column({ type: 'varchar', length: 150, nullable: true })
  serviceName: string | null

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: number

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  serviceFee: number

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  insuranceFee: number

  @Column({ type: 'jsonb', default: () => "'{}'" })
  requestPayload: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'" })
  providerPayload: Record<string, unknown>

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null
}
