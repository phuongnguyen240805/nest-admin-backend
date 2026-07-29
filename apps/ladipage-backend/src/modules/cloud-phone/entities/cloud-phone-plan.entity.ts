import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

/**
 * Rental plan offered in the Cloud Phone store. Prices are stored in VND
 * (integer đồng) per period. Tenant-scoped so each workspace can curate its
 * own catalog; a global/default catalog can be seeded per tenant.
 */
@Entity('lp_cloud_phone_plan')
@Index(['tenantId', 'code'], { unique: true })
export class CloudPhonePlanEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  code: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'int', default: 0 })
  priceDayVnd: number

  @Column({ type: 'int', default: 0 })
  priceWeekVnd: number

  @Column({ type: 'int', default: 0 })
  priceMonthVnd: number

  /** Free-form device group label this plan maps to (e.g. "Note 8", "Emulator"). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceGroup: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  cpu: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  ram: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  os: string | null

  @Column({ type: 'boolean', default: true })
  active: boolean
}
