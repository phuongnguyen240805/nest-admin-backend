import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'
import { AuthUser } from '@liora/nest-core/modules/auth/decorators/auth-user.decorator'

import { CreateLandingAiJobDto } from './dto/create-landing-ai-job.dto'
import { LandingAiMetricsService } from './services/landing-ai-metrics.service'
import { LandingAiService } from './services/landing-ai.service'

@ApiTags('Landing AI')
@ApiSecurity(API_SECURITY_AUTH)
@SkipThrottle()
@UseGuards(TenantGuard)
@Controller('landing-ai')
export class LandingAiController {
  constructor(
    private readonly landingAiService: LandingAiService,
    private readonly metricsService: LandingAiMetricsService,
  ) {}

  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  createJob(@Body() dto: CreateLandingAiJobDto, @AuthUser('uid') uid: number) {
    return this.landingAiService.createJob(dto, uid)
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string, @AuthUser('uid') uid: number) {
    return this.landingAiService.getJob(jobId, uid)
  }

  @Get('jobs/:jobId/events')
  getJobEvents(@Param('jobId') jobId: string, @AuthUser('uid') uid: number) {
    return this.landingAiService.getJobEvents(jobId, uid)
  }

  @Post('jobs/:jobId/cancel')
  cancelJob(@Param('jobId') jobId: string, @AuthUser('uid') uid: number) {
    return this.landingAiService.cancelJob(jobId, uid)
  }

  @Get('metrics')
  getMetrics() {
    return this.metricsService.getSnapshot()
  }

  @Get('quota')
  getQuota(@AuthUser('uid') uid: number) {
    return this.landingAiService.getAiQuota(uid)
  }
}