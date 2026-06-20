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

import {
  API_SECURITY_AUTH,
  GetOrgFromRequest,
  TenantGuard,
} from '@liora/nest-core'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'

import { CrmCustomFieldFacade } from '../crm-custom-field.facade'
import {
  CreateCustomFieldDto,
  CustomFieldQueryDto,
  UpdateCustomFieldDto,
} from '../dto/custom-field.dto'

@ApiTags('CRM - Custom Fields')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('crm/custom-fields')
export class CrmCustomFieldController {
  constructor(private readonly customFieldFacade: CrmCustomFieldFacade) {}

  @Get()
  list(@Query() dto: CustomFieldQueryDto) {
    return this.customFieldFacade.list(dto)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.customFieldFacade.detail(id)
  }

  @Post()
  create(
    @Body() dto: CreateCustomFieldDto,
    @GetOrgFromRequest() org: Organization | undefined,
  ) {
    return this.customFieldFacade.create(dto, org)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomFieldDto) {
    return this.customFieldFacade.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customFieldFacade.remove(id)
  }
}