import { Module } from '@nestjs/common'

import { BullMqModule, TenantModule } from '@liora/nest-core'

import { isBullMqEnabled, isBullMqWorkerEnabled } from '../../config/bullmq.app.config'
import { AdsOAuthCallbackController } from './controllers/ads-oauth-callback.controller'
import { AdsExtensionController } from './controllers/ads-extension.controller'
import { AdsPlatformController } from './controllers/ads-platform.controller'
import { AdsOperationProcessor } from './processors/ads-operation.processor'
import { MetaAdsPlugin } from './providers/meta/meta.plugin'
import { ShopeeAdsPlugin } from './providers/shopee/shopee.plugin'
import { TikTokAdsPlugin } from './providers/tiktok/tiktok.plugin'
import { ADS_PLATFORM_QUEUES } from './queues/constants'
import { AdsBrowserSnapshotService } from './services/ads-browser-snapshot.service'
import { AdsExtensionSessionGuard } from './guards/ads-extension-session.guard'
import { AdsConnectionService } from './services/ads-connection.service'
import { AdsJobService } from './services/ads-job.service'
import { AdsPlatformSharedModule } from './ads-platform.shared.module'

const queueImports = isBullMqEnabled()
  ? [
      BullMqModule.registerQueue({
        name: ADS_PLATFORM_QUEUES.OPERATIONS,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    ]
  : []

const workerProviders = isBullMqWorkerEnabled() ? [AdsOperationProcessor] : []

@Module({
  imports: [AdsPlatformSharedModule, TenantModule, ...queueImports],
  controllers: [AdsPlatformController, AdsOAuthCallbackController, AdsExtensionController],
  providers: [
    AdsConnectionService,
    AdsJobService,
    AdsBrowserSnapshotService,
    AdsExtensionSessionGuard,
    MetaAdsPlugin,
    TikTokAdsPlugin,
    ShopeeAdsPlugin,
    ...workerProviders,
  ],
  exports: [AdsPlatformSharedModule, AdsConnectionService, AdsJobService],
})
export class AdsPlatformModule {}
