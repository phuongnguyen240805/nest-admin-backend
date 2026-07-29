import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { GetOrgFromRequest, Public, TenantGuard } from '@liora/nest-core'
import { Perm } from '@liora/nest-core/modules/auth/decorators/permission.decorator'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'

import { getCommerceConfig } from '../commerce.config'
import { CommercePermissions } from '../commerce.permissions'
import { CreateCommerceProductDto } from '../dto/create-commerce-product.dto'
import { CommerceAccessService } from '../services/commerce-access.service'
import {
  CommerceAdminResourceService,
  type CommerceResourceKind,
} from '../services/commerce-admin-resource.service'
import { CommerceOrderService } from '../services/commerce-order.service'
import { CommerceProductService } from '../services/commerce-product.service'
import { CommerceStoreService } from '../services/commerce-store.service'

@ApiTags('Commerce')
@SkipThrottle()
@ApiBearerAuth()
@Controller('commerce')
@UseGuards(TenantGuard)
export class CommerceController {
  private readonly logger = new Logger(CommerceController.name)

  constructor(
    private readonly access: CommerceAccessService,
    private readonly adminResources: CommerceAdminResourceService,
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

  @Get('store')
  @Perm(CommercePermissions.STORE_MANAGE)
  @ApiOperation({ summary: 'Get store link for organization' })
  getStore(@GetOrgFromRequest() org: Organization) {
    this.access.assertEnabled()
    return this.storeService.getStore(org.id)
  }

  @Post('store/provision')
  @Perm(CommercePermissions.STORE_MANAGE)
  @ApiOperation({ summary: 'Ensure sales channel / store link for org' })
  provision(@GetOrgFromRequest() org: Organization) {
    this.access.assertEnabled()
    return this.storeService.ensureStore(org.id)
  }

  @Patch('store')
  @Perm(CommercePermissions.STORE_MANAGE)
  @ApiOperation({ summary: 'Update this organization commerce store settings' })
  updateStore(
    @Body()
    body: {
      salesChannelName?: string
      regionId?: string
      currencyCode?: string
      healthMessage?: string
    },
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.storeService.updateStore(org.id, body)
  }

  @Get('admin/:kind')
  @Perm(CommercePermissions.STORE_MANAGE)
  listAdminResources(
    @Param('kind') kind: string,
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.adminResources.list(this.resourceKind(kind), org.id)
  }

  @Post('admin/:kind')
  @Perm(CommercePermissions.STORE_MANAGE)
  createAdminResource(
    @Param('kind') kind: string,
    @Body() body: Record<string, unknown>,
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.adminResources.create(this.resourceKind(kind), org.id, body)
  }

  @Patch('admin/:kind/:id')
  @Perm(CommercePermissions.STORE_MANAGE)
  updateAdminResource(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.adminResources.update(
      this.resourceKind(kind),
      org.id,
      id,
      body,
    )
  }

  @Delete('admin/:kind/:id')
  @Perm(CommercePermissions.STORE_MANAGE)
  deleteAdminResource(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.adminResources.remove(this.resourceKind(kind), org.id, id)
  }

  @Get('products')
  @Perm(CommercePermissions.PRODUCT_READ)
  @ApiOperation({ summary: 'List commerce products' })
  async listProducts(@GetOrgFromRequest() org: Organization) {
    this.access.assertEnabled()
    const items = await this.productService.list(org.id)
    const cfg = getCommerceConfig()
    return {
      items,
      total: items.length,
      mockMode: cfg.mockMode,
      medusaBaseUrl: cfg.medusaBaseUrl,
    }
  }

  @Get('products/:id')
  @Perm(CommercePermissions.PRODUCT_READ)
  @ApiOperation({ summary: 'Get product by id' })
  getProduct(
    @Param('id') id: string,
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.productService.get(org.id, id)
  }

  @Post('products')
  @Perm(CommercePermissions.PRODUCT_WRITE)
  @ApiOperation({ summary: 'Create commerce product (writes to Medusa when not mock)' })
  async createProduct(
    @Body() dto: CreateCommerceProductDto,
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    const cfg = getCommerceConfig()
    this.logger.log(
      `POST /commerce/products org=${org.id} mock=${cfg.mockMode} title=${dto.title}`,
    )
    const product = await this.productService.create(org.id, dto)
    return {
      ...product,
      mockMode: cfg.mockMode,
      writtenToMedusa: !cfg.mockMode,
    }
  }

  @Patch('products/:id/status')
  @Perm(CommercePermissions.PRODUCT_WRITE)
  @ApiOperation({ summary: 'Update product status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'published' | 'draft' | 'archived' },
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.productService.updateStatus(org.id, id, body.status)
  }

  @Patch('products/:id/stock')
  @Perm(CommercePermissions.PRODUCT_WRITE)
  @ApiOperation({ summary: 'Update product stock for the organization channel' })
  updateStock(
    @Param('id') id: string,
    @Body() body: { stock: number },
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    if (!Number.isFinite(body.stock) || body.stock < 0) {
      throw new BadRequestException('stock must be a non-negative number')
    }
    return this.productService.updateStock(org.id, id, body.stock)
  }

  @Delete('products/:id')
  @Perm(CommercePermissions.PRODUCT_WRITE)
  @ApiOperation({ summary: 'Delete a product owned by this organization channel' })
  deleteProduct(
    @Param('id') id: string,
    @GetOrgFromRequest() org: Organization,
  ) {
    this.access.assertEnabled()
    return this.productService.remove(org.id, id)
  }

  @Get('orders')
  @Perm(CommercePermissions.ORDER_READ)
  @ApiOperation({ summary: 'List online commerce orders' })
  async listOrders(@GetOrgFromRequest() org: Organization) {
    this.access.assertEnabled()
    const items = await this.orderService.list(org.id)
    return { items, total: items.length }
  }

  @Public()
  @Post('storefront/session')
  @ApiOperation({ summary: 'Bootstrap storefront session (public runtime)' })
  storefrontSession(
    @Body() body: { organizationId?: string; pageId?: string },
  ) {
    this.access.assertEnabled()
    const orgId = body.organizationId?.trim()
    if (!orgId) {
      throw new BadRequestException('organizationId is required')
    }
    return this.storeService.createStorefrontSession(orgId, body.pageId)
  }

  private resourceKind(value: string): CommerceResourceKind {
    if (
      value === 'categories'
      || value === 'product-tags'
      || value === 'customers'
      || value === 'promotions'
    ) {
      return value
    }
    throw new BadRequestException('Unsupported commerce resource')
  }
}
