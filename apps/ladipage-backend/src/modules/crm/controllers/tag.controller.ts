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

import { CreateTagDto, TagQueryDto, UpdateTagDto } from '../dto/tag.dto'
import { CrmTagService } from '../services/tag.service'

@ApiTags('CRM - Tags')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('crm/tags')
export class CrmTagController {
  constructor(private readonly tagService: CrmTagService) {}

  @Get()
  list(@Query() dto: TagQueryDto) {
    return this.tagService.list(dto)
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.tagService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagService.create(dto)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tagService.remove(id)
  }
}