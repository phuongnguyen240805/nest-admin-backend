import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { SupabaseModule } from '@liora/supabase'

import { ScreenshotToCodeClient } from './clients/screenshot-to-code.client'
import { LandingAiJobEntity, LandingAiJobEventEntity } from './entities'
import { LandingAiJobStoreService } from './services/landing-ai-job-store.service'
import { LandingAiMetricsService } from './services/landing-ai-metrics.service'
import { LandingPagesStorageService } from './services/landing-pages-storage.service'

/** Providers tối thiểu cho BullMQ processor — không load Billing/Stripe/Tenant quota. */
@Module({
  imports: [
    SupabaseModule,
    TypeOrmModule.forFeature([LandingAiJobEntity, LandingAiJobEventEntity]),
  ],
  providers: [
    LandingAiJobStoreService,
    ScreenshotToCodeClient,
    LandingPagesStorageService,
    LandingAiMetricsService,
  ],
  exports: [
    LandingAiJobStoreService,
    ScreenshotToCodeClient,
    LandingPagesStorageService,
    LandingAiMetricsService,
    TypeOrmModule,
  ],
})
export class LandingAiWorkerCoreModule {}