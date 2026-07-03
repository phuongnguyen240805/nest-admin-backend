import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { KeywordResearchDto } from '../dto/keyword-research.dto'
import { AiSeoKeywordsService } from '../services/ai-seo-keywords.service'

@ApiTags('AI SEO - Keywords')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo/keywords')
export class AiSeoKeywordsController {
  constructor(private readonly keywordsService: AiSeoKeywordsService) {}

  @Post('research')
  research(@Body() dto: KeywordResearchDto) {
    return this.keywordsService.research(dto)
  }

  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.keywordsService.listSaved(projectId)
  }
}