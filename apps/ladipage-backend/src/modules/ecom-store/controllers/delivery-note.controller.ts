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
  CreateDeliveryNoteDto,
  DeliveryNoteQueryDto,
  UpdateDeliveryNoteDto,
} from '../dto/delivery-note.dto'
import { DeliveryNoteService } from '../services/delivery-note.service'

@ApiTags('Ecom - Delivery Notes')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/delivery-notes')
export class DeliveryNoteController {
  constructor(private readonly deliveryNoteService: DeliveryNoteService) {}

  @Get()
  list(@Query() dto: DeliveryNoteQueryDto) {
    return this.deliveryNoteService.list(dto)
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryNoteService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateDeliveryNoteDto) {
    return this.deliveryNoteService.create(dto)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryNoteDto,
  ) {
    return this.deliveryNoteService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryNoteService.remove(id)
  }
}