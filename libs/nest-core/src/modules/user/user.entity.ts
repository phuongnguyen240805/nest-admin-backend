import { Exclude } from 'class-transformer'
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  Relation,
} from 'typeorm'

import { CommonEntity } from '@liora/database/base.entity'

import { AccessTokenEntity } from '~/modules/auth/entities/access-token.entity'

import { DeptEntity } from '~/modules/system/dept/dept.entity'
import { RoleEntity } from '~/modules/system/role/role.entity'
import { Organization } from '../billing/entities/organization.entity'

@Entity({ name: 'sys_user' })
export class UserEntity extends CommonEntity {
  @Column({ unique: true })
  username: string

  // ==================== SYSTEM ADMIN (TRUNG TÂM QUẢN LÝ) ====================
  @Column({ type: 'boolean', default: false })
  isSuperAdmin: boolean

  // ==================== MULTI-TENANCY ====================
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @ManyToOne(() => Organization, org => org.users, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  @Exclude()
  @Column({ select: false })
  password: string

  @Column({ length: 32 })
  psalt: string

  @Column({ nullable: true })
  nickname: string

  @Column({ name: 'avatar', nullable: true })
  avatar: string

  @Column({ nullable: true })
  qq: string

  @Column({ nullable: true })
  email: string

  /** Linked Supabase Auth user (auth.users.id) */
  @Column({ name: 'supabase_user_id', type: 'uuid', nullable: true, unique: true })
  supabaseUserId: string | null

  @Column({ nullable: true })
  phone: string

  @Column({ nullable: true })
  remark: string

  @Column({ type: 'smallint', nullable: true, default: 1 })
  status: number

  @ManyToMany(() => RoleEntity, role => role.users)
  @JoinTable({
    name: 'sys_user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Relation<RoleEntity[]>

  @ManyToOne(() => DeptEntity, dept => dept.users)
  @JoinColumn({ name: 'dept_id' })
  dept: Relation<DeptEntity>

  @OneToMany(() => AccessTokenEntity, accessToken => accessToken.user, {
    cascade: true,
  })
  accessTokens: Relation<AccessTokenEntity[]>
}
