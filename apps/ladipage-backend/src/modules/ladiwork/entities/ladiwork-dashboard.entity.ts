import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_ladiwork_dashboard')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'widgetKey'])
export class LadiworkDashboardEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ name: 'widget_key', type: 'varchar', length: 100 })
  widgetKey: string

  @Column({ type: 'varchar', length: 50 })
  type: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null

  @Column({ type: 'boolean', default: true })
  visible: boolean

  @Column({ type: 'boolean', default: false })
  expanded: boolean

  @Column({ type: 'int', default: 0 })
  order: number

  @Column({ name: 'stage_id', type: 'varchar', length: 64, nullable: true })
  stageId: string | null

  @Column({ name: 'stage_name', type: 'varchar', length: 255, nullable: true })
  stageName: string | null

  @Column({ type: 'int', default: 0 })
  count: number

  @Column({ name: 'total_value', type: 'int', default: 0 })
  totalValue: number

  @Column({ type: 'jsonb', default: () => "'[]'" })
  stages: unknown[]
}
