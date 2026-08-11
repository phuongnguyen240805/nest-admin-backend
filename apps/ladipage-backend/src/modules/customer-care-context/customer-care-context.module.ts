import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantModule } from '@liora/nest-core'

import { CustomerCareModule } from '../customer-care/customer-care.module'
import { EcomStoreModule } from '../ecom-store/ecom-store.module'
import { OrderPaymentModule } from '../order-payment/order-payment.module'

import { CustomerCareConversationLinkEntity, CustomerCareConversationOrderLinkEntity } from '../customer-care/customer-care.entities'
import { DomainOutboxEventEntity } from '../domain-events/entities/domain-outbox-event.entity'
import { CustomerCareContextController } from './customer-care-context.controller'
import { CustomerCaseTimelineService } from './customer-case-timeline.service'
import { CustomerCareContextService } from './customer-care-context.service'
import { ContextBudgetService } from './context-budget.service'

@Module({
  imports: [
    TenantModule,
    CustomerCareModule,
    EcomStoreModule,
    OrderPaymentModule,
    TypeOrmModule.forFeature([
      CustomerCareConversationLinkEntity,
      CustomerCareConversationOrderLinkEntity,
      DomainOutboxEventEntity,
    ]),
  ],
  controllers: [CustomerCareContextController],
  providers: [CustomerCaseTimelineService, CustomerCareContextService, ContextBudgetService],
  exports: [CustomerCaseTimelineService, CustomerCareContextService, ContextBudgetService],
})
export class CustomerCareContextModule {}
