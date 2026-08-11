import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { CreateOrderPaymentDto } from '../dto/order-payment.dto'
import { OrderPaymentService } from '../services/order-payment.service'

@ApiTags('Ecom - Order Payments')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/orders/:orderId/payments')
export class OrderPaymentController {
  constructor(private readonly service: OrderPaymentService) {}

  @Get()
  list(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.service.list(orderId)
  }

  @Get(':paymentId')
  get(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.service.get(orderId, paymentId)
  }

  @Get(':paymentId/events')
  events(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.service.events(orderId, paymentId)
  }

  @Post('sepay')
  createSepay(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreateOrderPaymentDto,
  ) {
    return this.service.createSepay(orderId, dto)
  }

  @Post('cod')
  createCod(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreateOrderPaymentDto,
  ) {
    return this.service.createCod(orderId, dto)
  }
}
