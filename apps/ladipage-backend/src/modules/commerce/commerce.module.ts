import { Module } from '@nestjs/common'

import { TenantModule } from '@liora/nest-core'

import { CommerceController } from './controllers/commerce.controller'
import { CommerceAccessService } from './services/commerce-access.service'
import { CommerceOrderService } from './services/commerce-order.service'
import { CommerceProductService } from './services/commerce-product.service'
import { CommerceStoreService } from './services/commerce-store.service'

/**
 * CommerceModule — Medusa hybrid bridge (M0).
 * Default mock mode: in-memory catalog/channel without live Medusa.
 * Live: COMMERCE_MEDUSA_MOCK=false + MEDUSA_ADMIN_API_KEY + MEDUSA_BACKEND_URL.
 */
@Module({
  imports: [TenantModule],
  controllers: [CommerceController],
  providers: [
    CommerceAccessService,
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
