import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH } from '@liora/nest-core'
import { TenantGuard } from '@liora/nest-core'

import { EcomEntityType } from '../common/enums'
import {
  CreateCustomFieldDto,
  CustomFieldQueryDto,
  UpdateCustomFieldDto,
} from '../dto/custom-field.dto'
import { EcomCustomFieldService } from '../services/custom-field.service'

@ApiTags('Ecom - Custom Fields')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/custom-fields')
export class CustomFieldController {
  constructor(private readonly customFieldService: EcomCustomFieldService) {}

  @Get()
  list(@Query() dto: CustomFieldQueryDto) {
    return this.customFieldService.list(dto)
  }

  @Get(':id')
  detail(
    @Query('entity', new ParseEnumPipe(EcomEntityType)) entity: EcomEntityType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.customFieldService.detail(entity, id)
  }

  @Post()
  create(@Body() dto: CreateCustomFieldDto) {
    return this.customFieldService.create(dto)
  }

  @Patch(':id')
  update(
    @Query('entity', new ParseEnumPipe(EcomEntityType)) entity: EcomEntityType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldService.update(entity, id, dto)
  }

  @Delete(':id')
  remove(
    @Query('entity', new ParseEnumPipe(EcomEntityType)) entity: EcomEntityType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.customFieldService.remove(entity, id)
  }
}