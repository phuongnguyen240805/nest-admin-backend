import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { BillingModule, LANDING_PAGES_QUOTA, TenantModule } from '@liora/nest-core'
import { SupabaseModule } from '@liora/supabase'

import { ScreenshotToCodeClient } from './clients/screenshot-to-code.client'
import { LandingAiJobEntity, LandingAiJobEventEntity } from './entities'
import { AI_PROVIDER_GATEWAY } from './gateways/ai-provider-gateway.tokens'
import { FakeAiProviderGateway } from './gateways/fake-ai-provider.gateway'
import { OmniRouteAiProviderGateway } from './gateways/omniroute-ai-provider.gateway'
import { LandingAiHtmlGeneratorService } from './services/landing-ai-html-generator.service'
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
    FakeAiProviderGateway,
    OmniRouteAiProviderGateway,
    {
      provide: AI_PROVIDER_GATEWAY,
      inject: [FakeAiProviderGateway, OmniRouteAiProviderGateway],
      useFactory: (
        fakeGateway: FakeAiProviderGateway,
        omniRouteGateway: OmniRouteAiProviderGateway,
      ) => {
        if (
          process.env.AI_GATEWAY_DRIVER === 'fake'
          || process.env.LANDING_AI_MOCK_GENERATE === 'true'
        ) {
          return fakeGateway
        }
        return omniRouteGateway
      },
    },
    LandingAiHtmlGeneratorService,
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
    AI_PROVIDER_GATEWAY,
    FakeAiProviderGateway,
    OmniRouteAiProviderGateway,
    LandingAiHtmlGeneratorService,
    LandingPagesStorageService,
    LandingPageQuotaService,
    LandingAiQuotaService,
    LandingAiMetricsService,
    LANDING_PAGES_QUOTA,
    TypeOrmModule,
  ],
})
export class LandingAiSharedModule {}
