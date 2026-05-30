import { Column, Entity, OneToMany } from 'typeorm';
import { CompleteEntity } from '../../common/entity/common.entity';
import { TenantUser } from './tenant-user.entity';

@Entity('tenants')
export class Tenant extends CompleteEntity {
  @Column({ unique: true, length: 100 })
  handle?: string;                    

  @Column({ length: 255 })
  name?: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ default: 'active', length: 20 })
  status?: 'active' | 'inactive' | 'suspended';

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;    // commission rate, theme, config...

  @OneToMany(() => TenantUser, (user) => user.tenant, { cascade: true })
  users?: TenantUser[];
}