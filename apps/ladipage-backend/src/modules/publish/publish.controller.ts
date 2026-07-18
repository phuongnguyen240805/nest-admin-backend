import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { PublishService } from './publish.service'

type AiSeoSyncBody = {
  html?: string | null
  storeId?: string
  ensureSeoProject?: boolean
  publicUrl?: string | null
  hostname?: string | null
  name?: string | null
  slug?: string | null
}

@ApiTags('publish')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách publish jobs (demo)' })
  listPublishes() {
    return { message: 'List publishes (demo) - integrate with nest-core Billing for quota' }
  }

  @Post()
  @ApiOperation({ summary: 'Bắt đầu publish (demo — tích hợp Billing + FileManager)' })
  async publish() {
    return {
      message: 'Publish job started (demo)',
      usage: 'See CreditModule + PublishModule + SseModule from nest-core',
    }
  }

  /**
   * Fail-soft AI-SEO + Umami sync after FE L1 publish.
   * Ensures SEO project, links landing page, provisions Umami, injects scripts into HTML.
   * Does not block landing publish when FE already saved Supabase/edge artifacts.
   */
  @Post('landing-pages/:pageId/ai-seo-sync')
  @ApiOperation({
    summary: 'Sync AI-SEO project + Umami after landing publish (fail-soft)',
  })
  aiSeoSync(@Param('pageId') pageId: string, @Body() body: AiSeoSyncBody = {}) {
    return this.publishService.completeLandingPublish({
      pageId,
      html: body.html ?? null,
      storeId: body.storeId,
      ensureSeoProject: body.ensureSeoProject !== false,
      publicUrl: body.publicUrl,
      hostname: body.hostname,
      name: body.name,
      slug: body.slug,
    })
  }
}
