import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Organization } from './organization.entity'

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  LIFETIME = 'lifetime',
}

export enum Period {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
}

@Entity('sys_subscription')
// @Index(['organizationId'])
@Index(['deletedAt'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid', nullable: false, unique: true })
  organizationId: string

  @ManyToOne(() => Organization, org => org.subscription, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier

  @Column({ nullable: true })
  identifier?: string

  @Column({ type: 'timestamp', nullable: true })
  cancelAt?: Date

  @Column({
    type: 'enum',
    enum: Period,
    default: Period.MONTHLY,
  })
  period: Period

  @Column({ default: 0 })
  totalChannels: number

  @Column({ default: false })
  isLifetime: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt?: Date
}
