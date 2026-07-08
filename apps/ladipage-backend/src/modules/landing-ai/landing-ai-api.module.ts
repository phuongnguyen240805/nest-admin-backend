import { Module } from '@nestjs/common'

import { BullMqModule, TenantModule, UserModule } from '@liora/nest-core'

import { isBullMqEnabled } from '../../config/bullmq.app.config'
import { LandingAiController } from './landing-ai.controller'
import { LandingAiSharedModule } from './landing-ai.shared.module'
import { LANDING_AI_QUEUES } from './queues/constants'
import { LandingAiService } from './services/landing-ai.service'

const queueImports = isBullMqEnabled()
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
  imports: [LandingAiSharedModule, TenantModule, UserModule, ...queueImports],
  controllers: [LandingAiController],
  providers: [LandingAiService],
  exports: [LandingAiService, LandingAiSharedModule],
})
export class LandingAiApiModule {}