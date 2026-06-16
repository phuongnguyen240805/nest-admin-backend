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
  CreateCustomFieldDto,
  CustomFieldQueryDto,
  UpdateCustomFieldDto,
} from '../dto/custom-field.dto'
import { CrmCustomFieldService } from '../services/custom-field.service'

@ApiTags('CRM - Custom Fields')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('crm/custom-fields')
export class CrmCustomFieldController {
  constructor(private readonly customFieldService: CrmCustomFieldService) {}

  @Get()
  list(@Query() dto: CustomFieldQueryDto) {
    return this.customFieldService.list(dto)
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.customFieldService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateCustomFieldDto) {
    return this.customFieldService.create(dto)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customFieldService.remove(id)
  }
}