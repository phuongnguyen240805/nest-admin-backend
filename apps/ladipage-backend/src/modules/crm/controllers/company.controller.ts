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

import { API_SECURITY_AUTH } from '@liora/nest-core'
import { TenantGuard } from '@liora/nest-core'

import { CrmFacade } from '../crm.facade'
import {
  CompanyQueryDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from '../dto/company.dto'

@ApiTags('CRM - Companies')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('crm/companies')
export class CompanyController {
  constructor(private readonly crmFacade: CrmFacade) {}

  @Get()
  list(@Query() dto: CompanyQueryDto) {
    return this.crmFacade.listCompanies(dto)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.crmFacade.detailCompany(id)
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.crmFacade.createCompany(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.crmFacade.updateCompany(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.crmFacade.removeCompany(id)
  }
}