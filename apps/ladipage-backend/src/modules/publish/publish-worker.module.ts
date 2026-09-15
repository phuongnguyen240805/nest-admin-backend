import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { BullMqModule } from '@liora/nest-core'

import { isBullMqWorkerEnabled } from '../../config/bullmq.app.config'
import { LandingCmsModule } from '../landing-cms/landing-cms.module'
import { PublishJobEntity } from './entities'
import { PublishJobProcessor, PublishQueueReconciler } from './processors/publish-job.processor'
import { PUBLISH_QUEUE } from './queues/constants'
import { PublishExecutorClient } from './services/publish-executor.client'

const queueImports = isBullMqWorkerEnabled()
  ? [
      BullMqModule.registerQueue({
        name: PUBLISH_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3_000 },
          removeOnComplete: 500,
          removeOnFail: 2_000,
        },
      }),
    ]
  : []

const workerProviders = isBullMqWorkerEnabled()
  ? [PublishExecutorClient, PublishJobProcessor, PublishQueueReconciler]
  : []

@Module({
  imports: [
    TypeOrmModule.forFeature([PublishJobEntity]),
    LandingCmsModule,
    ...queueImports,
  ],
  providers: workerProviders,
})
export class PublishWorkerModule {}
