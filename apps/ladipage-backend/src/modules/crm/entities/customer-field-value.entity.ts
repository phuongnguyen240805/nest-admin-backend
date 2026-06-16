import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_customer_field_value')
@Index(['customerId', 'fieldId'], { unique: true })
export class CustomerFieldValueEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  customerId: number

  @Column({ type: 'int' })
  fieldId: number

  @Column({ type: 'text', nullable: true })
  value: string | null
}