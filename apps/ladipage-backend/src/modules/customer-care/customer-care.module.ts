import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule, TenantModule } from '@liora/nest-core'

import { CrmModule } from '../crm/crm.module'
import { EcomStoreModule } from '../ecom-store/ecom-store.module'

import { CustomerCareController, CustomerCareInternalController } from './customer-care.controller'
import { CUSTOMER_CARE_ENTITIES } from './customer-care.entities'
import { CustomerCareGateway } from './customer-care.gateway'
import { FacebookConnectorClient, LibreDeskClient, ZaloConnectorClient } from './customer-care.clients'
import { CustomerCareService } from './customer-care.service'
import { CustomerCareOperationalWorker } from './customer-care-operational.worker'

@Module({
  imports: [
    TypeOrmModule.forFeature(CUSTOMER_CARE_ENTITIES),
    AuthModule,
    TenantModule,
    CrmModule,
    EcomStoreModule,
  ],
  controllers: [CustomerCareController, CustomerCareInternalController],
  providers: [CustomerCareGateway, LibreDeskClient, ZaloConnectorClient, FacebookConnectorClient, CustomerCareService, CustomerCareOperationalWorker],
  exports: [CustomerCareService],
})
export class CustomerCareModule {}
