import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { BullMqModule, TenantModule } from '@liora/nest-core'

import { isBullMqWorkerEnabled } from '../../config/bullmq.app.config'
import { PageEntity } from '../publish/entities'
import {
  SeoProjectEntity,
  SeoProjectPageEntity,
  SeoTaskEntity,
} from './entities'
import { UnlighthouseProcessor } from './processors/unlighthouse.processor'
import { AI_SEO_QUEUES } from './queues/constants'
import { LabScanService } from './services/lab-scan.service'
import { UnlighthouseRunner } from './services/unlighthouse.runner'

const workerProviders = isBullMqWorkerEnabled() ? [UnlighthouseProcessor] : []

const queueImports = isBullMqWorkerEnabled()
  ? [
      BullMqModule.registerQueue({
        name: AI_SEO_QUEUES.LIGHTHOUSE,
        defaultJobOptions: {
          priority: 10,
          attempts: 2,
          backoff: { type: 'exponential', delay: 10_000 },
        },
      }),
    ]
  : []

/**
 * Worker-side module: consumes ai-seo-lighthouse queue.
 * Does not mount HTTP controllers.
 */
@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([
      SeoProjectEntity,
      SeoProjectPageEntity,
      SeoTaskEntity,
      PageEntity,
    ]),
    ...queueImports,
  ],
  providers: [UnlighthouseRunner, LabScanService, ...workerProviders],
})
export class AiSeoLighthouseWorkerModule {}
