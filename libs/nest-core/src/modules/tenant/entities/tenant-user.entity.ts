import { Column, Entity, ManyToOne } from 'typeorm';
import { CompleteEntity } from '../../common/entity/common.entity';
import { Tenant } from './tenant.entity';

@Entity('tenant_users')
export class TenantUser extends CompleteEntity {
    @ManyToOne(() => Tenant, (tenant) => tenant.users, { onDelete: 'CASCADE' })
    tenant?: Tenant;

    @Column()
    tenantId?: number;

    @Column({ length: 100 })
    email?: string;

    @Column({ length: 50, default: 'owner' })
    role?: 'owner' | 'admin' | 'staff';

    @Column({ default: true })
    isActive?: boolean;
}