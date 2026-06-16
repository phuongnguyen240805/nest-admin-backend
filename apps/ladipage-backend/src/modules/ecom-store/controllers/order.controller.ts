import {
  Body,
  Controller,
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
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderStatusDto,
} from '../dto/order.dto'
import { OrderService } from '../services/order.service'

@ApiTags('Ecom - Orders')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @ApiOperation({ summary: 'List orders (filter by status or incomplete)' })
  list(@Query() dto: OrderQueryDto) {
    return this.orderService.list(dto)
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.detail(id)
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto)
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, dto)
  }
}