import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_customer_company')
@Index(['customerId', 'companyId'], { unique: true })
export class CustomerCompanyEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  customerId: number

  @Column({ type: 'int' })
  companyId: number
}