import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

export type ShippingProvider = 'ghn' | 'ghtk'

@Entity('lp_shipping_integration')
@Index(['tenantId', 'provider'], { unique: true })
export class ShippingIntegrationEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 20 })
  provider: ShippingProvider

  @Column({ type: 'varchar', length: 100 })
  name: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'text' })
  ciphertext: string

  @Column({ type: 'varchar', length: 64 })
  iv: string

  @Column({ type: 'varchar', length: 64 })
  authTag: string

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings: Record<string, unknown>

  @Column({ type: 'timestamptz', nullable: true })
  connectedAt: Date | null
}
