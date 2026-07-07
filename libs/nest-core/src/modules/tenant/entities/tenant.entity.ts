import { Column, Entity, OneToMany } from 'typeorm';
import { CompleteEntity } from '@liora/database/base.entity';
import { TenantUser } from './tenant-user.entity';

@Entity('tenants')
export class Tenant extends CompleteEntity {
  @Column({ unique: true, length: 100 })
  handle?: string;

  /** Bridge to sys_organizations — one tenant per organization */
  @Column({ type: 'uuid', nullable: true, unique: true })
  organizationId?: string;

  /** Product app that owns this workspace (ladipage, nest-admin, …) */
  @Column({ length: 50, default: 'ladipage' })
  appCode?: string;

  @Column({ length: 255 })
  name?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ default: 'active', length: 20 })
  status?: 'active' | 'inactive' | 'suspended';

  @Column({ type: 'json', nullable: true })
  settings?: Record<string, any>;    

  @OneToMany(() => TenantUser, (user) => user.tenant, { cascade: true })
  users?: TenantUser[];
}