import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { API_SECURITY_AUTH, RequestTimeoutMs, TenantGuard } from '@liora/nest-core'

import { CreateLabScanDto } from '../dto/create-lab-scan.dto'
import { LabScanService } from '../services/lab-scan.service'
import { assertResolvedScanableUrl } from '../utils/unlighthouse-url-policy'

@ApiTags('AI SEO - Lab Scans (Unlighthouse)')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo/lab-scans')
export class AiSeoLabScansController {
  constructor(private readonly labScanService: LabScanService) {}

  /** Start a bounded, tenant-scoped scan. Private-network access is server-controlled. */
  @Post()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @RequestTimeoutMs(180_000)
  async start(
    @Body() dto: CreateLabScanDto,
    @Headers('authorization') authorization?: string,
  ) {
    const allowLocal =
      process.env.NODE_ENV !== 'production' &&
      (process.env.UNLIGHTHOUSE_ALLOW_LOCAL === 'true' ||
        dto.trigger === 'editor' ||
        dto.trigger === 'list')
    const safeDto: CreateLabScanDto = { ...dto, allowLocal }
    if (safeDto.targetUrl) {
      const checked = await assertResolvedScanableUrl(safeDto.targetUrl, { allowLocal })
      if (checked.ok === false) throw new BadRequestException(checked.reason)
      safeDto.targetUrl = checked.url
    }
    return this.labScanService.startLabScan(safeDto, authorization)
  }

  @Get(':jobId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  get(@Param('jobId') jobId: string) {
    return this.labScanService.getLabScan(jobId)
  }
}
