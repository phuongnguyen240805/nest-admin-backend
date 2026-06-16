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
import { CreateTagDto, TagQueryDto, UpdateTagDto } from '../dto/tag.dto'
import { EcomTagService } from '../services/tag.service'

@ApiTags('Ecom - Tags')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/tags')
export class TagController {
  constructor(private readonly tagService: EcomTagService) {}

  @Get()
  list(@Query() dto: TagQueryDto) {
    return this.tagService.list(dto)
  }

  @Get(':id')
  detail(
    @Query('entity', new ParseEnumPipe(EcomEntityType)) entity: EcomEntityType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tagService.detail(entity, id)
  }

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagService.create(dto)
  }

  @Patch(':id')
  update(
    @Query('entity', new ParseEnumPipe(EcomEntityType)) entity: EcomEntityType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagService.update(entity, id, dto)
  }

  @Delete(':id')
  remove(
    @Query('entity', new ParseEnumPipe(EcomEntityType)) entity: EcomEntityType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tagService.remove(entity, id)
  }
}