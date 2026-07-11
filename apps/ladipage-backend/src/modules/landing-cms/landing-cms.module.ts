import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SupabaseModule } from '@liora/supabase'

import { LandingPageService } from './application/landing-page.service'
import { PageRegistryStore } from './application/page-registry.store'
import { InstaticArtifactService } from './instatic/instatic-artifact.service'
import { InstaticImportService } from './instatic/instatic-import.service'
import { InstaticSsoService } from './instatic/instatic-sso.service'
import { InstaticClient } from './instatic/instatic.client'
import { InternalPublishController } from './internal-publish.controller'
import { LandingCmsConfig } from './landing-cms.config'
import {
  LandingCmsController,
  LandingCmsHealthController,
} from './landing-cms.controller'
import { LANDING_PAGE_PORT } from './ports/landing-page.port'

@Module({
  imports: [
    ConfigModule.forFeature(LandingCmsConfig),
    SupabaseModule,
  ],
  controllers: [
    LandingCmsHealthController,
    LandingCmsController,
    InternalPublishController,
  ],
  providers: [
    InstaticClient,
    InstaticSsoService,
    InstaticImportService,
    InstaticArtifactService,
    PageRegistryStore,
    LandingPageService,
    { provide: LANDING_PAGE_PORT, useExisting: LandingPageService },
  ],
  exports: [LandingPageService, LANDING_PAGE_PORT, InstaticClient],
})
export class LandingCmsModule {}
