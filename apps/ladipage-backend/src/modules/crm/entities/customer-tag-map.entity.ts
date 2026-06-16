import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_customer_tag_map')
@Index(['customerId', 'tagId'], { unique: true })
export class CustomerTagMapEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  customerId: number

  @Column({ type: 'int' })
  tagId: number
}