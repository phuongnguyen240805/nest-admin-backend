import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, AuthUser, TenantGuard } from '@liora/nest-core'

import { CreatePublishJobDto } from './dto/create-publish-job.dto'
import { PublishJobService } from './services/publish-job.service'
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
  constructor(
    private readonly publishService: PublishService,
    private readonly publishJobService: PublishJobService,
  ) {}

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

  @Post('landing-pages/:pageId/jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue an idempotent landing-page publish job' })
  async createLandingPublishJob(
    @Param('pageId') pageId: string,
    @Body() dto: CreatePublishJobDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @AuthUser('uid') userId: number,
  ) {
    const job = await this.publishJobService.createOrReplay({
      pageId,
      userId,
      idempotencyKey: idempotencyKey ?? '',
      dto,
    })
    return this.publishJobService.toPublic(job)
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get the current user publish job status' })
  async getLandingPublishJob(
    @Param('jobId') jobId: string,
    @AuthUser('uid') userId: number,
  ) {
    const job = await this.publishJobService.getForUser(jobId, userId)
    return this.publishJobService.toPublic(job)
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
