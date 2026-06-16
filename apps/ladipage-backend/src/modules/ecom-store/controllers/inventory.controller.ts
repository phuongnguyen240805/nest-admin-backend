import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH } from '@liora/nest-core'
import { TenantGuard } from '@liora/nest-core'

import { UpdateInventoryDto } from '../dto/inventory.dto'
import { InventoryService } from '../services/inventory.service'

@ApiTags('Ecom - Inventory')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Patch(':productId')
  @ApiOperation({ summary: 'Update product inventory' })
  update(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.inventoryService.update(productId, dto)
  }
}