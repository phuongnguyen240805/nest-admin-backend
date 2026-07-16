import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantModule } from '@liora/nest-core'

import { PageEntity } from '../publish/entities'
import { PublishModule } from '../publish/publish.module'
import { AiSeoAgentsController } from './controllers/ai-seo-agents.controller'
import { AiSeoIntegrationsController } from './controllers/ai-seo-integrations.controller'
import { AiSeoJobsController } from './controllers/ai-seo-jobs.controller'
import { AiSeoKeywordsController } from './controllers/ai-seo-keywords.controller'
import { AiSeoProjectsController } from './controllers/ai-seo-projects.controller'
import { AiSeoTasksController } from './controllers/ai-seo-tasks.controller'
import { AiSeoTrafficController } from './controllers/ai-seo-traffic.controller'
import { AiSeoWebsiteProjectsController } from './controllers/ai-seo-website-projects.controller'
import {
  SeoIntegrationEntity,
  SeoKeywordCacheEntity,
  SeoProjectEntity,
  SeoProjectPageEntity,
  SeoTaskEntity,
} from './entities'
import { AiSeoCacheService } from './services/ai-seo-cache.service'
import { AiSeoIntegrationService } from './services/ai-seo-integration.service'
import { AiSeoJobsService } from './services/ai-seo-jobs.service'
import { AiSeoKeywordsService } from './services/ai-seo-keywords.service'
import { AiSeoLandingPageService } from './services/ai-seo-landing-page.service'
import { AiSeoProjectService } from './services/ai-seo-project.service'
import { AiSeoPublishService } from './services/ai-seo-publish.service'
import { AiSeoQuotaService } from './services/ai-seo-quota.service'
import { AiSeoTaskService } from './services/ai-seo-task.service'
import { AiSeoTrafficService } from './services/ai-seo-traffic.service'
import { AiSeoWebsiteService } from './services/ai-seo-website.service'
import { OpenSeoClientService } from './services/openseo-client.service'
import { UmamiClientService } from './services/umami-client.service'

@Module({
  imports: [
    TenantModule,
    forwardRef(() => PublishModule),
    TypeOrmModule.forFeature([
      SeoProjectEntity,
      SeoProjectPageEntity,
      SeoTaskEntity,
      SeoKeywordCacheEntity,
      SeoIntegrationEntity,
      PageEntity,
    ]),
  ],
  controllers: [
    AiSeoProjectsController,
    AiSeoTasksController,
    AiSeoIntegrationsController,
    AiSeoJobsController,
    AiSeoKeywordsController,
    AiSeoAgentsController,
    AiSeoWebsiteProjectsController,
    AiSeoTrafficController,
  ],
  providers: [
    AiSeoProjectService,
    AiSeoLandingPageService,
    AiSeoWebsiteService,
    AiSeoTaskService,
    AiSeoIntegrationService,
    AiSeoJobsService,
    AiSeoKeywordsService,
    AiSeoTrafficService,
    AiSeoPublishService,
    OpenSeoClientService,
    UmamiClientService,
    AiSeoCacheService,
    AiSeoQuotaService,
  ],
  exports: [
    AiSeoProjectService,
    AiSeoPublishService,
    OpenSeoClientService,
    AiSeoTrafficService,
    UmamiClientService,
  ],
})
export class AiSeoModule {}