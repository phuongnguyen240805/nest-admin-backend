import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'

import { CommonEntity } from '@liora/database/base.entity'

import { Organization } from '~/modules/billing/entities/organization.entity'
import { UserEntity } from '~/modules/user/user.entity'

import { SysAppEntity } from './sys-app.entity'
import { Tenant } from './tenant.entity'

@Entity('sys_user_app_membership')
@Index(['userId', 'appCode'], { unique: true })
@Index(['appCode'])
@Index(['organizationId'])
export class UserAppMembershipEntity extends CommonEntity {
  @Column()
  userId: number

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity

  @Column({ length: 50 })
  appCode: string

  @ManyToOne(() => SysAppEntity)
  @JoinColumn({ name: 'appCode', referencedColumnName: 'code' })
  app?: SysAppEntity

  @Column({ type: 'uuid' })
  organizationId: string

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization

  @Column()
  tenantId: number

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: Tenant

  @Column({ length: 50, default: 'owner' })
  role: 'owner' | 'admin' | 'staff'

  @Column({ type: 'smallint', default: 1 })
  status: number
}