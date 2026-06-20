import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { CrmOpportunityService } from '@liora/crm-core'
import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import {
  CreateOpportunityDto,
  MoveOpportunityStageDto,
  OpportunityQueryDto,
  UpdateOpportunityDto,
} from '../dto/opportunity.dto'
import { CrmEnabledGuard } from '../guards/crm-enabled.guard'

@ApiTags('CRM - Opportunities')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard, CrmEnabledGuard)
@Controller('crm/opportunities')
export class OpportunityController {
  constructor(private readonly opportunityService: CrmOpportunityService) {}

  @Get()
  list(@Query() dto: OpportunityQueryDto) {
    return this.opportunityService.list(dto)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.opportunityService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateOpportunityDto) {
    return this.opportunityService.create({
      name: dto.name,
      amount: dto.amount
        ? { amountMicros: Math.round(dto.amount * 1_000_000), currencyCode: 'VND' }
        : null,
      closeDate: dto.closeDate ?? null,
      stageId: dto.stageId,
      stageSlug: dto.stageSlug,
      personId: dto.personId ?? null,
      companyId: dto.companyId ?? null,
      position: dto.position,
    })
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.opportunityService.update(id, {
      name: dto.name,
      amount:
        dto.amount !== undefined
          ? dto.amount
            ? { amountMicros: Math.round(dto.amount * 1_000_000), currencyCode: 'VND' }
            : null
          : undefined,
      closeDate: dto.closeDate,
      personId: dto.personId,
      companyId: dto.companyId,
      position: dto.position,
    })
  }

  @Patch(':id/stage')
  moveStage(@Param('id') id: string, @Body() dto: MoveOpportunityStageDto) {
    return this.opportunityService.moveStage(id, dto.stageId)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.opportunityService.remove(id)
  }
}