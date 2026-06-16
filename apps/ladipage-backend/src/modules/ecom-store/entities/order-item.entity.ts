import { Column, Entity, Index } from 'typeorm'

import { CommonEntity } from '@liora/database'

@Entity('lp_order_item')
@Index(['orderId'])
export class OrderItemEntity extends CommonEntity {
  @Column({ type: 'int' })
  orderId: number

  @Column({ type: 'int', nullable: true })
  productId: number | null

  @Column({ type: 'varchar', length: 255 })
  productName: string

  @Column({ type: 'int', default: 1 })
  quantity: number

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  unitPrice: number

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalPrice: number
}