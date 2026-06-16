import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_order_tag_map')
@Index(['orderId', 'tagId'], { unique: true })
export class OrderTagMapEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  orderId: number

  @Column({ type: 'int' })
  tagId: number
}