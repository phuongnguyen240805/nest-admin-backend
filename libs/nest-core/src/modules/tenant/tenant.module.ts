import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenantInterceptor } from '~/common/interceptors/tenant.interceptor';
import { Organization } from '~/modules/billing/entities/organization.entity';
import { Subscription } from '~/modules/billing/entities/subscription.entity';
import { UserEntity } from '~/modules/user/user.entity';

import { OrganizationProvisioningService } from './organization-provisioning.service';
import { TenantContextService } from './tenant-context.service';
import { TenantRequestBootstrapService } from './tenant-request-bootstrap.service';
import { TenantGuard } from './tenant.guard';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantResolutionService } from './tenant-resolution.service';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';
import { TenantUser } from './entities/tenant-user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Tenant, TenantUser, Organization, Subscription, UserEntity])],
    providers: [
        TenantContextService,
        TenantRequestBootstrapService,
        TenantGuard,
        TenantContextInterceptor,
        TenantResolutionService,
        OrganizationProvisioningService,
        TenantService,
        TenantInterceptor,
    ],
    exports: [
        TenantContextService,
        TenantRequestBootstrapService,
        TenantGuard,
        TenantContextInterceptor,
        TenantResolutionService,
        OrganizationProvisioningService,
        TenantService,
        TenantInterceptor,
        TypeOrmModule,
    ],
})
export class TenantModule { }