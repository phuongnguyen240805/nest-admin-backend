import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { API_SECURITY_AUTH, RequestTimeoutMs, TenantGuard } from '@liora/nest-core'

import { CreateLabScanDto } from '../dto/create-lab-scan.dto'
import { LabScanService } from '../services/lab-scan.service'

@ApiTags('AI SEO - Lab Scans (Unlighthouse)')
@ApiSecurity(API_SECURITY_AUTH)
@SkipThrottle()
@UseGuards(TenantGuard)
@Controller('ai-seo/lab-scans')
export class AiSeoLabScansController {
  constructor(private readonly labScanService: LabScanService) {}

  /**
   * Start Unlighthouse lab scan (BullMQ or inline mock).
   * Private data: tenant-scoped; never cross-account.
   * SkipThrottle: scan is user-triggered and may poll job status without 429.
   */
  @Post()
  @RequestTimeoutMs(180_000)
  start(
    @Body() dto: CreateLabScanDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.labScanService.startLabScan(dto, authorization)
  }

  @Get(':jobId')
  get(@Param('jobId') jobId: string) {
    return this.labScanService.getLabScan(jobId)
  }
}
