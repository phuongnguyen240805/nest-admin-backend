import {
  Column,
  CreateDateColumn,
  Entity,
  // Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { UserEntity } from '~/modules/user/user.entity'
import { Subscription } from './subscription.entity'
// import { Post } from './post.entity'
// import { UserOrganization } from './user-organization.entity'

export enum ShortLinkPreference {
  ASK = 'ASK',
  ALWAYS = 'ALWAYS',
  NEVER = 'NEVER',
}

@Entity('sys_organizations')
@Index(['apiKey'])
@Index(['streakSince'])
@Index(['paymentId'])
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiKey: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentId: string

  @Column({ type: 'datetime', nullable: true })
  streakSince: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @Column({ type: 'boolean', default: false })
  allowTrial: boolean

  @Column({ type: 'boolean', default: false })
  isTrailing: boolean

  @Column({
    type: 'enum',
    enum: ShortLinkPreference,
    default: ShortLinkPreference.ASK,
  })
  shortlink: ShortLinkPreference

  @OneToMany(() => UserEntity, user => user.organization)
  users: UserEntity[]

  @OneToOne(() => Subscription, subscription => subscription.organization)
  @JoinColumn() // Bắt buộc phải có JoinColumn ở một phía của OneToOne
  subscription: Subscription

  // @OneToMany(() => Post, post => post.organization)
  // post: Post[]

  // @OneToMany(() => Post, post => post.submittedForOrg)
  // submittedPost: Post[]

  // @OneToMany(() => AutoPost, autoPost => autoPost.organization)
  // autoPost: AutoPost[]
}
