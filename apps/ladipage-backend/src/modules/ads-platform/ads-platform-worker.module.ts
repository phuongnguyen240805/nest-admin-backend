import { Module } from '@nestjs/common'

import { BullMqModule } from '@liora/nest-core'

import { isBullMqWorkerEnabled } from '../../config/bullmq.app.config'
import { AdsPlatformSharedModule } from './ads-platform.shared.module'
import { AdsOperationProcessor } from './processors/ads-operation.processor'
import { MetaAdsPlugin } from './providers/meta/meta.plugin'
import { ShopeeAdsPlugin } from './providers/shopee/shopee.plugin'
import { TikTokAdsPlugin } from './providers/tiktok/tiktok.plugin'
import { ADS_PLATFORM_QUEUES } from './queues/constants'

const queueImports = isBullMqWorkerEnabled()
  ? [BullMqModule.registerQueue({ name: ADS_PLATFORM_QUEUES.OPERATIONS })]
  : []

const providers = isBullMqWorkerEnabled()
  ? [AdsOperationProcessor, MetaAdsPlugin, TikTokAdsPlugin, ShopeeAdsPlugin]
  : []

@Module({
  imports: [AdsPlatformSharedModule, ...queueImports],
  providers,
})
export class AdsPlatformWorkerModule {}
