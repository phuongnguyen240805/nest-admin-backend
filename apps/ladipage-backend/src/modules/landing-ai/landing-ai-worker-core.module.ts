import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { SupabaseModule } from '@liora/supabase'

import { ScreenshotToCodeClient } from './clients/screenshot-to-code.client'
import { LandingAiJobEntity, LandingAiJobEventEntity } from './entities'
import { AI_PROVIDER_GATEWAY } from './gateways/ai-provider-gateway.tokens'
import { FakeAiProviderGateway } from './gateways/fake-ai-provider.gateway'
import { OmniRouteAiProviderGateway } from './gateways/omniroute-ai-provider.gateway'
import { LandingAiHtmlGeneratorService } from './services/landing-ai-html-generator.service'
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
    LandingAiMetricsService,
  ],
  exports: [
    LandingAiJobStoreService,
    ScreenshotToCodeClient,
    AI_PROVIDER_GATEWAY,
    FakeAiProviderGateway,
    OmniRouteAiProviderGateway,
    LandingAiHtmlGeneratorService,
    LandingPagesStorageService,
    LandingAiMetricsService,
    TypeOrmModule,
  ],
})
export class LandingAiWorkerCoreModule {}
