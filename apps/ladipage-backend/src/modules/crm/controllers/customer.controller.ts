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
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateCustomerDto,
} from '../dto/customer.dto'

@ApiTags('CRM - Customers')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('crm/customers')
export class CustomerController {
  constructor(private readonly crmFacade: CrmFacade) {}

  @Get()
  list(@Query() dto: CustomerQueryDto) {
    return this.crmFacade.listCustomers(dto)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.crmFacade.detailCustomer(id)
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.crmFacade.createCustomer(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.crmFacade.updateCustomer(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.crmFacade.removeCustomer(id)
  }
}