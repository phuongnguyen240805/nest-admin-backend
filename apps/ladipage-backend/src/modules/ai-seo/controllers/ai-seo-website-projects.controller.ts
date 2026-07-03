import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { AiSeoWebsiteService } from '../services/ai-seo-website.service'

type ConnectAiSeoBody = {
  aiSeoProjectId: string
}

@ApiTags('AI SEO - Website Projects')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo/website-projects')
export class AiSeoWebsiteProjectsController {
  constructor(private readonly websiteService: AiSeoWebsiteService) {}

  @Get()
  list() {
    return this.websiteService.listWebsiteProjects()
  }

  @Get(':websiteProjectId/pages')
  listPages(@Param('websiteProjectId') websiteProjectId: string) {
    return this.websiteService.listWebsitePages(websiteProjectId)
  }

  @Post(':websiteProjectId/pages/:pageId/publish')
  publish(
    @Param('websiteProjectId') websiteProjectId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.websiteService.publishWebsitePage(websiteProjectId, pageId)
  }

  @Post(':websiteProjectId/pages/:pageId/connect-ai-seo')
  connectAiSeo(
    @Param('websiteProjectId') websiteProjectId: string,
    @Param('pageId') pageId: string,
    @Body() body: ConnectAiSeoBody,
  ) {
    return this.websiteService.connectWebsitePageToAiSeo(
      websiteProjectId,
      pageId,
      body.aiSeoProjectId,
    )
  }
}