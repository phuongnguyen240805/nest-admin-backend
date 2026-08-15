import { Module } from '@nestjs/common'
import { BullMqModule } from '@liora/nest-core'

import { isBullMqEnabled } from '../../config/bullmq.app.config'
import { CrmCoreModule } from '@liora/crm-core'

import { CustomerCareModule } from '../customer-care/customer-care.module'
import { CustomerCareAiModule } from '../customer-care-ai/customer-care-ai.module'
import { EcomStoreModule } from '../ecom-store/ecom-store.module'
import { OrderPaymentModule } from '../order-payment/order-payment.module'
import { AutomationCoreModule } from './automation-core.module'
import { AUTOMATION_QUEUES } from './queues/constants'
import { AutomationOutboundDispatcherService } from './services/automation-outbound-dispatcher.service'
import { AutomationActionDispatcherService } from './actions/automation-action-dispatcher.service'
import { AutomationTriggerRuntimeService } from './triggers/automation-trigger-runtime.service'
import { AutomationTriggerShadowService } from './triggers/automation-trigger-shadow.service'

const queueImports = isBullMqEnabled()
  ? [
      BullMqModule.registerQueue({
        name: AUTOMATION_QUEUES.TRIGGER,
        defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2_000 } },
      }),
      BullMqModule.registerQueue({
        name: AUTOMATION_QUEUES.FLOW,
        defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2_000 } },
      }),
    ]
  : []

const runtimeProviders = isBullMqEnabled()
  ? [AutomationTriggerRuntimeService, AutomationOutboundDispatcherService, AutomationActionDispatcherService]
  : []

@Module({
  imports: [AutomationCoreModule, CustomerCareModule, CustomerCareAiModule, EcomStoreModule, OrderPaymentModule, CrmCoreModule, ...queueImports],
  providers: [AutomationTriggerShadowService, ...runtimeProviders],
  exports: [AutomationCoreModule],
})
export class AutomationModule {}
