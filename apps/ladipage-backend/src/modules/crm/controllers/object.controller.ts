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

import { CrmObjectDefinitionService } from '@liora/crm-core'
import {
  API_SECURITY_AUTH,
  GetOrgFromRequest,
  TenantGuard,
} from '@liora/nest-core'
import { BillingService } from '@liora/nest-core/modules/billing/services/billing.service'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'

import {
  CreateFieldDto,
  CreateObjectDto,
  ObjectQueryDto,
  UpdateFieldDto,
  UpdateObjectDto,
} from '../dto/object.dto'
import { CrmEnabledGuard } from '../guards/crm-enabled.guard'
import { EnterpriseGuard } from '../guards/enterprise.guard'

@ApiTags('CRM - Custom Objects (Enterprise)')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard, CrmEnabledGuard, EnterpriseGuard)
@Controller('crm/objects')
export class CrmObjectController {
  constructor(
    private readonly objectService: CrmObjectDefinitionService,
    private readonly billingService: BillingService,
  ) {}

  @Get()
  list(@Query() dto: ObjectQueryDto) {
    return this.objectService.list(dto)
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.objectService.detailBySlug(slug)
  }

  @Post()
  async create(
    @Body() dto: CreateObjectDto,
    @GetOrgFromRequest() org: Organization | undefined,
  ) {
    const billing = org ? await this.billingService.getCurrentBilling(org) : null
    return this.objectService.create(
      {
        slug: dto.slug,
        label: dto.label,
        description: dto.description,
        fields: dto.fields,
      },
      billing?.subscriptionTier,
    )
  }

  @Patch(':slug')
  update(@Param('slug') slug: string, @Body() dto: UpdateObjectDto) {
    return this.objectService.update(slug, {
      label: dto.label,
      description: dto.description,
    })
  }

  @Delete(':slug')
  remove(@Param('slug') slug: string) {
    return this.objectService.remove(slug)
  }

  @Post(':slug/fields')
  addField(@Param('slug') slug: string, @Body() dto: CreateFieldDto) {
    return this.objectService.addField(slug, dto)
  }

  @Patch(':slug/fields/:fieldId')
  updateField(
    @Param('slug') slug: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldDto,
  ) {
    return this.objectService.updateField(slug, fieldId, dto)
  }

  @Delete(':slug/fields/:fieldId')
  removeField(
    @Param('slug') slug: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.objectService.removeField(slug, fieldId)
  }
}