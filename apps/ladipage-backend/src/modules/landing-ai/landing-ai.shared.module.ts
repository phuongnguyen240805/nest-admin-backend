import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { BillingModule, LANDING_PAGES_QUOTA, TenantModule } from '@liora/nest-core'
import { SupabaseModule } from '@liora/supabase'

import { ScreenshotToCodeClient } from './clients/screenshot-to-code.client'
import { LandingAiJobEntity, LandingAiJobEventEntity } from './entities'
import { LandingAiJobStoreService } from './services/landing-ai-job-store.service'
import { LandingAiMetricsService } from './services/landing-ai-metrics.service'
import { LandingAiQuotaService } from './services/landing-ai-quota.service'
import { LandingPageQuotaService } from './services/landing-page-quota.service'
import { LandingPagesStorageService } from './services/landing-pages-storage.service'

@Global()
@Module({
  imports: [
    TenantModule,
    SupabaseModule,
    BillingModule,
    TypeOrmModule.forFeature([LandingAiJobEntity, LandingAiJobEventEntity]),
  ],
  providers: [
    LandingAiJobStoreService,
    ScreenshotToCodeClient,
    LandingPagesStorageService,
    LandingPageQuotaService,
    LandingAiQuotaService,
    LandingAiMetricsService,
    {
      provide: LANDING_PAGES_QUOTA,
      useExisting: LandingPageQuotaService,
    },
  ],
  exports: [
    TenantModule,
    LandingAiJobStoreService,
    ScreenshotToCodeClient,
    LandingPagesStorageService,
    LandingPageQuotaService,
    LandingAiQuotaService,
    LandingAiMetricsService,
    LANDING_PAGES_QUOTA,
    TypeOrmModule,
  ],
})
export class LandingAiSharedModule {}