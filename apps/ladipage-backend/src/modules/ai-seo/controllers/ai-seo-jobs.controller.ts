import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { AiSeoJobsService } from '../services/ai-seo-jobs.service'

@ApiTags('AI SEO - Jobs')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo/jobs')
export class AiSeoJobsController {
  constructor(private readonly jobsService: AiSeoJobsService) {}

  @Get(':jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.jobsService.getJob(jobId)
  }

  @Get(':jobId/events')
  getJobEvents(@Param('jobId') jobId: string) {
    return this.jobsService.getJobEvents(jobId)
  }
}
