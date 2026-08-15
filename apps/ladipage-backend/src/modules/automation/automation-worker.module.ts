import { Module } from '@nestjs/common'
import { BullMqModule } from '@liora/nest-core'

import { isBullMqWorkerEnabled } from '../../config/bullmq.app.config'
import { AutomationCoreModule } from './automation-core.module'
import { AutomationBroadcastSchedulerService } from './broadcast/automation-broadcast-scheduler.service'
import { AutomationBroadcastProcessor } from './processors/automation-broadcast.processor'
import { AutomationFlowProcessor } from './processors/automation-flow.processor'
import { AutomationResumeProcessor } from './processors/automation-resume.processor'
import { AutomationFlowRecoverySchedulerService } from './runtime/automation-flow-recovery-scheduler.service'
import { AutomationSequenceProcessor } from './processors/automation-sequence.processor'
import { AutomationTriggerProcessor } from './processors/automation-trigger.processor'
import { AUTOMATION_QUEUES } from './queues/constants'
import { AutomationSequenceSchedulerService } from './sequence/automation-sequence-scheduler.service'

const queueImports = isBullMqWorkerEnabled()
  ? Object.values(AUTOMATION_QUEUES).map((name) => BullMqModule.registerQueue({
      name,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    }))
  : []

const workerProviders = isBullMqWorkerEnabled()
  ? [
      AutomationTriggerProcessor,
      AutomationFlowProcessor,
      AutomationResumeProcessor,
      AutomationSequenceProcessor,
      AutomationBroadcastProcessor,
      AutomationSequenceSchedulerService,
      AutomationBroadcastSchedulerService,
      AutomationFlowRecoverySchedulerService,
    ]
  : []

@Module({
  imports: [AutomationCoreModule, ...queueImports],
  providers: workerProviders,
})
export class AutomationWorkerModule {}
