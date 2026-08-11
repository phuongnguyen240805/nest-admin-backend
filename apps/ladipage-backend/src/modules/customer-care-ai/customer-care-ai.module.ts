import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AiGatewayModule } from '@liora/ai-gateway'
import { TenantModule } from '@liora/nest-core'

import { CustomerCareModule } from '../customer-care/customer-care.module'
import { CustomerCareContextModule } from '../customer-care-context/customer-care-context.module'
import { EcomStoreModule } from '../ecom-store/ecom-store.module'
import { OrderPaymentModule } from '../order-payment/order-payment.module'
import { DomainOutboxEventEntity } from '../domain-events/entities/domain-outbox-event.entity'
import { CustomerCareAiController } from './customer-care-ai.controller'
import { CustomerCareAiMetricsService } from './observability/customer-care-ai-metrics.service'
import { CustomerCareAiHealthService } from './observability/customer-care-ai-health.service'
import { CustomerCareAiAutomationService } from './automation/customer-care-ai-automation.service'
import { CustomerCareAiConfigService } from './config/customer-care-ai-config.service'
import { CustomerCareAiActionService } from './actions/customer-care-ai-action.service'
import { CustomerCareAiActionPolicyService } from './actions/customer-care-ai-action-policy.service'
import { CustomerCareAiActionRequestEntity, CustomerCareAiFeedbackEntity, CustomerCareAiJobEntity, CustomerCareAiResultEntity, CustomerCareAiTenantConfigEntity, CustomerCareAiToolCallEntity } from './entities'
import { CustomerCareAiFeedbackService } from './orchestration/customer-care-ai-feedback.service'
import { CustomerCareAiOrchestratorService } from './orchestration/customer-care-ai-orchestrator.service'
import { ConversationAiTool, PreviousConversationsAiTool } from './tools/conversation.tool'
import { CustomerAiTool } from './tools/customer.tool'
import { CustomerCareAiToolRegistry } from './tools/customer-care-ai-tool.registry'
import { LinkedOrdersAiTool, OrderDetailAiTool } from './tools/order.tool'
import { PaymentEventsAiTool, PaymentStatusAiTool } from './tools/payment.tool'
import { PolicyAiTool } from './tools/policy.tool'
import { ProductDetailAiTool, ProductSearchAiTool } from './tools/product.tool'
import { ShippingEventsAiTool, ShippingStatusAiTool } from './tools/shipping.tool'
import { CustomerCareAiToolGuardService } from './tools/tool-guard.service'

export const CUSTOMER_CARE_AI_ENTITIES = [
  CustomerCareAiTenantConfigEntity, CustomerCareAiJobEntity, CustomerCareAiResultEntity,
  CustomerCareAiFeedbackEntity, CustomerCareAiActionRequestEntity, CustomerCareAiToolCallEntity,
]

@Module({
  imports: [
    TenantModule, AiGatewayModule, CustomerCareModule, CustomerCareContextModule, EcomStoreModule, OrderPaymentModule,
    TypeOrmModule.forFeature([...CUSTOMER_CARE_AI_ENTITIES, DomainOutboxEventEntity]),
  ],
  controllers: [CustomerCareAiController],
  providers: [
    CustomerCareAiOrchestratorService, CustomerCareAiFeedbackService, CustomerCareAiActionService, CustomerCareAiActionPolicyService, CustomerCareAiConfigService, CustomerCareAiAutomationService, CustomerCareAiHealthService, CustomerCareAiMetricsService, CustomerCareAiToolRegistry, CustomerCareAiToolGuardService,
    CustomerAiTool, ConversationAiTool, PreviousConversationsAiTool, LinkedOrdersAiTool, OrderDetailAiTool,
    PaymentStatusAiTool, PaymentEventsAiTool, ShippingStatusAiTool, ShippingEventsAiTool,
    ProductDetailAiTool, ProductSearchAiTool, PolicyAiTool,
  ],
  exports: [CustomerCareAiOrchestratorService, CustomerCareAiActionService, CustomerCareAiConfigService, CustomerCareAiMetricsService, CustomerCareAiToolRegistry, TypeOrmModule],
})
export class CustomerCareAiModule {}
