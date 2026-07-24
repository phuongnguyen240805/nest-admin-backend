import {
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { Public, TenantGuard } from '@liora/nest-core'

import { getCommerceConfig } from '../commerce.config'
import { CreateCommerceProductDto } from '../dto/create-commerce-product.dto'
import { CommerceAccessService } from '../services/commerce-access.service'
import { CommerceOrderService } from '../services/commerce-order.service'
import { CommerceProductService } from '../services/commerce-product.service'
import { CommerceStoreService } from '../services/commerce-store.service'

function resolveOrgId(headerOrg?: string): string {
  return headerOrg?.trim() || 'default-org'
}

@ApiTags('Commerce')
@SkipThrottle()
@Controller('commerce')
export class CommerceController {
  private readonly logger = new Logger(CommerceController.name)

  constructor(
    private readonly access: CommerceAccessService,
    private readonly storeService: CommerceStoreService,
    private readonly productService: CommerceProductService,
    private readonly orderService: CommerceOrderService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Commerce / Medusa bridge health' })
  health() {
    return this.storeService.health()
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Get('store')
  @ApiOperation({ summary: 'Get or provision store link for organization' })
  getStore(@Headers('x-organization-id') orgHeader?: string) {
    this.access.assertEnabled()
    return this.storeService.getStore(resolveOrgId(orgHeader))
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Post('store/provision')
  @ApiOperation({ summary: 'Ensure sales channel / store link for org' })
  provision(@Headers('x-organization-id') orgHeader?: string) {
    this.access.assertEnabled()
    return this.storeService.ensureStore(resolveOrgId(orgHeader))
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Get('products')
  @ApiOperation({ summary: 'List commerce products' })
  async listProducts(@Headers('x-organization-id') orgHeader?: string) {
    this.access.assertEnabled()
    const items = await this.productService.list(resolveOrgId(orgHeader))
    const cfg = getCommerceConfig()
    return {
      items,
      total: items.length,
      mockMode: cfg.mockMode,
      medusaBaseUrl: cfg.medusaBaseUrl,
    }
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by id' })
  getProduct(
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    this.access.assertEnabled()
    return this.productService.get(resolveOrgId(orgHeader), id)
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Post('products')
  @ApiOperation({ summary: 'Create commerce product (writes to Medusa when not mock)' })
  async createProduct(
    @Body() dto: CreateCommerceProductDto,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    this.access.assertEnabled()
    const orgId = resolveOrgId(orgHeader)
    const cfg = getCommerceConfig()
    this.logger.log(
      `POST /commerce/products org=${orgId} mock=${cfg.mockMode} title=${dto.title}`,
    )
    const product = await this.productService.create(orgId, dto)
    return {
      ...product,
      mockMode: cfg.mockMode,
      writtenToMedusa: !cfg.mockMode,
    }
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Patch('products/:id/status')
  @ApiOperation({ summary: 'Update product status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'published' | 'draft' | 'archived' },
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    this.access.assertEnabled()
    return this.productService.updateStatus(
      resolveOrgId(orgHeader),
      id,
      body.status,
    )
  }

  @ApiBearerAuth()
  @UseGuards(TenantGuard)
  @Get('orders')
  @ApiOperation({ summary: 'List online commerce orders' })
  listOrders(@Headers('x-organization-id') orgHeader?: string) {
    this.access.assertEnabled()
    const items = this.orderService.list(resolveOrgId(orgHeader))
    return { items, total: items.length }
  }

  @Public()
  @Post('storefront/session')
  @ApiOperation({ summary: 'Bootstrap storefront session' })
  storefrontSession(
    @Body() body: { organizationId?: string; pageId?: string },
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    this.access.assertEnabled()
    const orgId = body.organizationId || resolveOrgId(orgHeader)
    return this.storeService.createStorefrontSession(orgId, body.pageId)
  }
}
