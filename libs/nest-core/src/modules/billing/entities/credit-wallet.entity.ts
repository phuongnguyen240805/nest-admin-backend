import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('sys_credit_wallet')
export class CreditWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalSpent: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
