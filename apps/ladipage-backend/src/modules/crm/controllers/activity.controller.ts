import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { CrmActivityService } from '@liora/crm-core'
import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { ActivityQueryDto } from '../dto/activity.dto'
import { CrmEnabledGuard } from '../guards/crm-enabled.guard'

@ApiTags('CRM - Activities')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard, CrmEnabledGuard)
@Controller('crm/activities')
export class ActivityController {
  constructor(private readonly activityService: CrmActivityService) {}

  @Get()
  list(@Query() dto: ActivityQueryDto) {
    return this.activityService.list(dto)
  }
}