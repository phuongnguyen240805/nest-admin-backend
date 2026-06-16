import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { GetOrgFromRequest, TenantGuard } from '@liora/nest-core'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'

import { DashboardService } from './dashboard.service'

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(TenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Dashboard summary — today orders, pending, revenue, customers, subscription, recent orders, 7-day chart',
  })
  getSummary(@GetOrgFromRequest() org: Organization | undefined) {
    return this.dashboardService.getSummary(org)
  }

  @Get('onboarding')
  @ApiOperation({ summary: 'Onboarding progress based on existing tenant data' })
  getOnboarding() {
    return this.dashboardService.getOnboarding()
  }
}