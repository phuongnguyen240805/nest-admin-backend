import { Module } from '@nestjs/common'

import { BullMqModule } from '@liora/nest-core'

import { isBullMqWorkerEnabled } from '../../config/bullmq.app.config'
import { LandingAiWorkerCoreModule } from './landing-ai-worker-core.module'
import { LandingAiGenerateProcessor } from './processors/landing-ai-generate.processor'
import { LANDING_AI_QUEUES } from './queues/constants'

const workerProviders = isBullMqWorkerEnabled()
  ? [LandingAiGenerateProcessor]
  : []

const queueImports = isBullMqWorkerEnabled()
  ? [
      BullMqModule.registerQueue({
        name: LANDING_AI_QUEUES.GENERATE,
        defaultJobOptions: {
          priority: 10,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
      BullMqModule.registerQueue({
        name: LANDING_AI_QUEUES.UPDATE,
        defaultJobOptions: { priority: 1 },
      }),
    ]
  : []

@Module({
  imports: [LandingAiWorkerCoreModule, ...queueImports],
  providers: [...workerProviders],
})
export class LandingAiWorkerModule {}