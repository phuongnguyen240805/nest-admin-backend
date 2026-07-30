import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantModule } from '@liora/nest-core'

import { CommerceController } from './controllers/commerce.controller'
import {
  CommerceResourceOwnershipEntity,
  CommerceStoreLinkEntity,
} from './entities'
import { CommerceAccessService } from './services/commerce-access.service'
import { CommerceAdminResourceService } from './services/commerce-admin-resource.service'
import { CommerceOrderService } from './services/commerce-order.service'
import { CommerceProductService } from './services/commerce-product.service'
import { CommerceResourceOwnershipService } from './services/commerce-resource-ownership.service'
import { CommerceStoreService } from './services/commerce-store.service'
import { CommerceStoreLinkService } from './services/commerce-store-link.service'
import { MedusaProvisioningService } from './services/medusa-provisioning.service'

/**
 * CommerceModule — Medusa hybrid bridge (M0).
 * Store link is persisted (TypeORM, tenant-scoped); in live mode a real
 * Medusa sales channel + publishable key are provisioned per organization.
 * Live: COMMERCE_MEDUSA_MOCK=false + MEDUSA_ADMIN_API_KEY + MEDUSA_BACKEND_URL.
 */
@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([
      CommerceStoreLinkEntity,
      CommerceResourceOwnershipEntity,
    ]),
  ],
  controllers: [CommerceController],
  providers: [
    CommerceAccessService,
    CommerceAdminResourceService,
    CommerceResourceOwnershipService,
    CommerceStoreLinkService,
    MedusaProvisioningService,
    CommerceStoreService,
    CommerceProductService,
    CommerceOrderService,
  ],
  exports: [
    CommerceStoreService,
    CommerceProductService,
    CommerceOrderService,
    CommerceAccessService,
  ],
})
export class CommerceModule {}
