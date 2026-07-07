import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantInterceptor } from '~/common/interceptors/tenant.interceptor'
import { Organization } from '~/modules/billing/entities/organization.entity'
import { Subscription } from '~/modules/billing/entities/subscription.entity'
import { UserEntity } from '~/modules/user/user.entity'

import { AppMembershipService } from './app-membership.service'
import { OrganizationProvisioningService } from './organization-provisioning.service'
import { TenantContextService } from './tenant-context.service'
import { TenantRequestBootstrapService } from './tenant-request-bootstrap.service'
import { TenantGuard } from './tenant.guard'
import { TenantContextInterceptor } from './tenant-context.interceptor'
import { TenantResolutionService } from './tenant-resolution.service'
import { TenantService } from './tenant.service'
import { SysAppEntity } from './entities/sys-app.entity'
import { Tenant } from './entities/tenant.entity'
import { TenantUser } from './entities/tenant-user.entity'
import { UserAppMembershipEntity } from './entities/user-app-membership.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantUser,
      SysAppEntity,
      UserAppMembershipEntity,
      Organization,
      Subscription,
      UserEntity,
    ]),
  ],
  providers: [
    TenantContextService,
    AppMembershipService,
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
    AppMembershipService,
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
export class TenantModule {}