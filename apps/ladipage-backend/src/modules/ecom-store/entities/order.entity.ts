import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import { OrderStatus } from '../common/enums'

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

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: number

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod: string | null

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