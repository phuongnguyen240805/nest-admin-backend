import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import {
  CreateShipmentDto,
  SaveShippingIntegrationDto,
  ShippingQuoteDto,
} from '../dto/shipping.dto'
import type { ShippingProvider } from '../entities'
import { ShippingService } from '../shipping/shipping.service'

@ApiTags('Ecom - Shipping')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('integrations')
  integrations() {
    return this.shipping.integrationsList()
  }

  @Put('integrations/:provider')
  saveIntegration(
    @Param('provider') provider: ShippingProvider,
    @Body() dto: SaveShippingIntegrationDto,
  ) {
    return this.shipping.saveIntegration(provider, dto)
  }

  @Post('integrations/:provider/test')
  testIntegration(@Param('provider') provider: ShippingProvider) {
    return this.shipping.testIntegration(provider)
  }

  @Get('locations/provinces')
  provinces(@Query('provider') provider: ShippingProvider = 'ghn') {
    return this.shipping.provinces(provider)
  }

  @Get('locations/districts')
  districts(
    @Query('provinceId', ParseIntPipe) provinceId: number,
    @Query('provider') provider: ShippingProvider = 'ghn',
  ) {
    return this.shipping.districts(provider, provinceId)
  }

  @Get('locations/wards')
  wards(
    @Query('districtId', ParseIntPipe) districtId: number,
    @Query('provider') provider: ShippingProvider = 'ghn',
  ) {
    return this.shipping.wards(provider, districtId)
  }

  @Get('services')
  services(
    @Query('toDistrict', ParseIntPipe) toDistrict: number,
    @Query('provider') provider: ShippingProvider = 'ghn',
  ) {
    return this.shipping.services(provider, toDistrict)
  }

  @Post('quote')
  quote(@Body() dto: ShippingQuoteDto) {
    return this.shipping.quote(dto)
  }

  @Get('orders/:orderId')
  shipment(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.shipping.detailForOrder(orderId)
  }

  @Post('orders/:orderId')
  create(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shipping.create(orderId, dto)
  }

  @Post('orders/:orderId/refresh')
  refresh(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.shipping.refresh(orderId)
  }

  @Post('orders/:orderId/retry')
  retry(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.shipping.retryPending(orderId)
  }

  @Get('orders/:orderId/events')
  events(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.shipping.events(orderId)
  }

  @Post('orders/:orderId/cancel')
  cancel(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.shipping.cancel(orderId)
  }
}
