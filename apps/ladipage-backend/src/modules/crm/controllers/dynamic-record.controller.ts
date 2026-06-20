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

import { CrmDynamicRecordService } from '@liora/crm-core'
import {
  API_SECURITY_AUTH,
  GetOrgFromRequest,
  TenantGuard,
} from '@liora/nest-core'
import { BillingService } from '@liora/nest-core/modules/billing/services/billing.service'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'

import {
  CreateRecordDto,
  RecordQueryDto,
  UpdateRecordDto,
} from '../dto/object.dto'
import { CrmEnabledGuard } from '../guards/crm-enabled.guard'
import { EnterpriseGuard } from '../guards/enterprise.guard'

@ApiTags('CRM - Custom Object Records (Enterprise)')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard, CrmEnabledGuard, EnterpriseGuard)
@Controller('crm/objects/:slug/records')
export class CrmDynamicRecordController {
  constructor(
    private readonly recordService: CrmDynamicRecordService,
    private readonly billingService: BillingService,
  ) {}

  @Get()
  list(@Param('slug') slug: string, @Query() dto: RecordQueryDto) {
    return this.recordService.list(slug, dto)
  }

  @Get(':id')
  detail(@Param('slug') slug: string, @Param('id') id: string) {
    return this.recordService.detail(slug, id)
  }

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateRecordDto,
    @GetOrgFromRequest() org: Organization | undefined,
  ) {
    const billing = org ? await this.billingService.getCurrentBilling(org) : null
    return this.recordService.create(
      slug,
      { data: dto.data },
      billing?.subscriptionTier,
    )
  }

  @Patch(':id')
  update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.recordService.update(slug, id, { data: dto.data })
  }

  @Delete(':id')
  remove(@Param('slug') slug: string, @Param('id') id: string) {
    return this.recordService.remove(slug, id)
  }
}