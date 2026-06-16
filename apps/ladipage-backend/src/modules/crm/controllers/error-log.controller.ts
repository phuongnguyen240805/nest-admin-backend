import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH } from '@liora/nest-core'
import { TenantGuard } from '@liora/nest-core'

import { ErrorLogQueryDto } from '../dto/error-log.dto'
import { ErrorLogService } from '../services/error-log.service'

@ApiTags('CRM - Error Logs')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('crm/error-logs')
export class ErrorLogController {
  constructor(private readonly errorLogService: ErrorLogService) {}

  @Get()
  @ApiOperation({ summary: 'List sync error logs' })
  list(@Query() dto: ErrorLogQueryDto) {
    return this.errorLogService.list(dto)
  }
}