import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { BullMqModule, UserModule } from '@liora/nest-core'

import { isBullMqEnabled } from '../../config/bullmq.app.config'
import { AiSeoModule } from '../ai-seo/ai-seo.module'
import { PageEntity, PublishJobEntity } from './entities'
import { InternalPublishController } from './internal-publish.controller'
import { PublishController } from './publish.controller'
import { PublishService } from './publish.service'
import { PUBLISH_QUEUE } from './queues/constants'
import { PageService } from './services/page.service'
import { PublishExecutorClient } from './services/publish-executor.client'
import { PublishJobService } from './services/publish-job.service'

const queueImports = isBullMqEnabled()
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

/**
 * API-side publish module. Rendering/processors never run here; the API only
 * validates, persists an idempotent job row and enqueues it for worker.main.ts.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PageEntity, PublishJobEntity]),
    UserModule,
    forwardRef(() => AiSeoModule),
    ...queueImports,
  ],
  controllers: [PublishController, InternalPublishController],
  providers: [
    PageService,
    PublishService,
    PublishExecutorClient,
    PublishJobService,
  ],
  exports: [TypeOrmModule, PageService, PublishService, PublishJobService],
})
export class PublishModule {}
