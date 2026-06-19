import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_delivery_note')
@Index(['orderId'])
export class DeliveryNoteEntity extends TenantScopedEntity {
  @Column({ type: 'int' })
  orderId: number

  @Column({ type: 'text', nullable: true })
  content: string | null

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: string

  @Column({ type: 'timestamp', nullable: true })
  shippedAt: Date | null
}