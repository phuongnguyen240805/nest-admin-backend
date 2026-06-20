import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { CrmPipelineService } from '@liora/crm-core'
import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { CrmEnabledGuard } from '../guards/crm-enabled.guard'

@ApiTags('CRM - Pipelines')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard, CrmEnabledGuard)
@Controller('crm/pipelines')
export class PipelineController {
  constructor(private readonly pipelineService: CrmPipelineService) {}

  @Get('default')
  getDefault() {
    return this.pipelineService.getDefaultPipeline()
  }
}