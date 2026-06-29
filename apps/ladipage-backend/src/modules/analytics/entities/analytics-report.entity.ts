import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_analytics_report')
@Index(['tenantId', 'reportType'])
@Index(['tenantId', 'productId'])
export class AnalyticsReportEntity extends TenantScopedEntity {
  @Column({ name: 'report_type', type: 'varchar', length: 50, default: 'top_product' })
  reportType: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ name: 'product_id', type: 'int', nullable: true })
  productId: number | null

  @Column({ name: 'product_type', type: 'varchar', length: 100, nullable: true })
  productType: string | null

  @Column({ type: 'int', default: 0 })
  quantity: number

  @Column({ type: 'int', default: 0 })
  total: number

  @Column({ name: 'num_order', type: 'int', default: 0 })
  numOrder: number

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  refund: string | null

  @Column({ type: 'int', default: 0 })
  restock: number

  @Column({ name: 'up_sell_ids', type: 'varchar', length: 500, nullable: true })
  upSellIds: string | null

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null
}
