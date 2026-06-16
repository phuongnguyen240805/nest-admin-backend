import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_customer_segment')
@Index(['customerId', 'segmentId'], { unique: true })
export class CustomerSegmentEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  customerId: number

  @Column({ type: 'int' })
  segmentId: number
}