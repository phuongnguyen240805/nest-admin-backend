import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH } from '@liora/nest-core'
import { TenantGuard } from '@liora/nest-core'

import {
  CompanyQueryDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from '../dto/company.dto'
import { CompanyService } from '../services/company.service'

@ApiTags('CRM - Companies')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('crm/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  list(@Query() dto: CompanyQueryDto) {
    return this.companyService.list(dto)
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.remove(id)
  }
}