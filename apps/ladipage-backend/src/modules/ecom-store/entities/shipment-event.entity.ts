import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import type { ShippingProvider } from '../shipping/core'

@Entity('lp_shipment_event')
@Index(['tenantId', 'shipmentId', 'occurredAt'])
@Index(['tenantId', 'providerEventId'], { unique: true })
export class ShipmentEventEntity extends TenantScopedEntity {
  @Column({ type: 'int' })
  shipmentId: number

  @Column({ type: 'varchar', length: 20 })
  provider: ShippingProvider

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerEventId: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  providerStatus: string | null

  @Column({ type: 'varchar', length: 50 })
  status: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null

  @Column({ type: 'timestamptz' })
  occurredAt: Date

  @Column({ type: 'jsonb', default: () => "'{}'" })
  rawPayload: Record<string, unknown>
}
