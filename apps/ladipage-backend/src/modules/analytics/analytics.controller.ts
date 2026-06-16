import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { TenantGuard } from '@liora/nest-core'

import { AnalyticsService } from './analytics.service'
import { ReportQueryDto } from './dto/report-query.dto'

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics/reports')
@UseGuards(TenantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Sales report — revenue, orders, AOV by daily buckets' })
  getSalesReport(@Query() query: ReportQueryDto) {
    return this.analyticsService.getSalesReport(query.from, query.to)
  }

  @Get('business')
  @ApiOperation({ summary: 'Business report — conversion funnel and top products' })
  getBusinessReport(@Query() query: ReportQueryDto) {
    return this.analyticsService.getBusinessReport(query.from, query.to)
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customer report — new vs returning and segment breakdown' })
  getCustomersReport(@Query() query: ReportQueryDto) {
    return this.analyticsService.getCustomersReport(query.from, query.to)
  }

  @Get('automation')
  @ApiOperation({ summary: 'Automation report (stub — zeros when no automation data)' })
  getAutomationReport(@Query() query: ReportQueryDto) {
    return this.analyticsService.getAutomationReport(query.from, query.to)
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Jobs report (stub — zeros when no job data)' })
  getJobsReport(@Query() query: ReportQueryDto) {
    return this.analyticsService.getJobsReport(query.from, query.to)
  }
}