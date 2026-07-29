import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import { getCommerceConfig } from '../commerce.config'
import { MedusaHttpClient } from '../clients/medusa-http.client'
import {
  mapMedusaProductToDto,
  type MedusaAdminProduct,
} from '../mappers/medusa-product.mapper'
import type {
  CommerceProductDto,
  CommerceProductStatus,
  CommerceStoreLinkDto,
  CreateCommerceProductInput,
} from '../types/commerce.types'
import { commerceMemoryStore } from './commerce-memory.store'
import { CommerceStoreService } from './commerce-store.service'

type MedusaProductEnvelope = {
  product?: MedusaAdminProduct
  products?: MedusaAdminProduct[]
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `product-${Date.now()}`
  )
}

/** True when the product lists the given sales channel among its channels. */
function productInChannel(
  product: MedusaAdminProduct,
  salesChannelId: string,
): boolean {
  return (product.sales_channels ?? []).some((c) => c?.id === salesChannelId)
}

@Injectable()
export class CommerceProductService {
  private readonly logger = new Logger(CommerceProductService.name)

  constructor(private readonly storeService: CommerceStoreService) {}

  async list(organizationId: string): Promise<CommerceProductDto[]> {
    const cfg = getCommerceConfig()
    const link = await this.storeService.ensureStore(organizationId)

    if (cfg.mockMode) {
      return commerceMemoryStore.listProducts(organizationId)
    }

    const channelId = this.requireChannel(link)
    const admin = MedusaHttpClient.fromConfig('admin')
    // Cross-tenant isolation: scope the Admin query to this org's sales
    // channel so an org can only ever see its own catalog (ADR-005).
    const result = await admin.get<MedusaProductEnvelope>(
      `/admin/products?limit=100&sales_channel_id[]=${encodeURIComponent(channelId)}`,
    )

    if (!result.ok) {
      this.logger.warn(
        `list products failed org=${organizationId}: ${result.error ?? result.status}`,
      )
      throw new InternalServerErrorException(
        result.error ?? 'Unable to list Medusa products',
      )
    }

    // Defense in depth: drop anything not actually in the channel, in case a
    // Medusa version ignores the filter param.
    return (result.data?.products ?? [])
      .filter((product) => productInChannel(product, channelId))
      .map((product) =>
        mapMedusaProductToDto(product, channelId, link.currencyCode),
      )
  }

  async get(organizationId: string, id: string): Promise<CommerceProductDto> {
    const cfg = getCommerceConfig()
    const link = await this.storeService.ensureStore(organizationId)

    if (cfg.mockMode) {
      const product = commerceMemoryStore.getProduct(organizationId, id)
      if (!product) throw new NotFoundException('Commerce product not found')
      return product
    }

    const channelId = this.requireChannel(link)
    const admin = MedusaHttpClient.fromConfig('admin')
    const result = await admin.get<MedusaProductEnvelope>(
      `/admin/products/${id}?fields=*sales_channels`,
    )

    if (!result.ok || !result.data?.product) {
      throw new NotFoundException(result.error ?? 'Commerce product not found')
    }

    // Cross-tenant isolation: never return a product from another org's channel.
    if (!productInChannel(result.data.product, channelId)) {
      throw new NotFoundException('Commerce product not found')
    }

    return mapMedusaProductToDto(
      result.data.product,
      channelId,
      link.currencyCode,
    )
  }

  async create(
    organizationId: string,
    input: CreateCommerceProductInput,
  ): Promise<CommerceProductDto> {
    const cfg = getCommerceConfig()
    const link = await this.storeService.ensureStore(organizationId)

    if (cfg.mockMode) {
      this.logger.log(
        `create product MOCK mode org=${organizationId} title=${input.title} - not written to Medusa Admin`,
      )
      return commerceMemoryStore.createProduct(
        organizationId,
        input,
        link.salesChannelId,
        link.currencyCode,
      )
    }

    return this.createOnMedusa(
      organizationId,
      input,
      this.requireChannel(link),
      link.currencyCode,
    )
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: CommerceProductStatus,
  ): Promise<CommerceProductDto> {
    const cfg = getCommerceConfig()
    const link = await this.storeService.ensureStore(organizationId)

    if (cfg.mockMode) {
      const updated = commerceMemoryStore.updateStatus(organizationId, id, status)
      if (!updated) throw new NotFoundException('Commerce product not found')
      return updated
    }

    const channelId = this.requireChannel(link)
    // Verify ownership before mutating — get() throws 404 if the product is
    // not in this org's channel, preventing cross-tenant writes.
    await this.get(organizationId, id)

    const admin = MedusaHttpClient.fromConfig('admin')
    const result = await admin.request<MedusaProductEnvelope>(
      'POST',
      `/admin/products/${id}`,
      { status: this.toMedusaStatus(status) },
    )

    if (!result.ok || !result.data?.product) {
      throw new InternalServerErrorException(
        result.error ?? 'Unable to update Medusa product status',
      )
    }

    return mapMedusaProductToDto(
      result.data.product,
      channelId,
      link.currencyCode,
    )
  }

  async updateStock(
    organizationId: string,
    id: string,
    stock: number,
  ): Promise<CommerceProductDto> {
    const cfg = getCommerceConfig()
    const link = await this.storeService.ensureStore(organizationId)
    const normalized = Math.max(0, Math.trunc(stock))
    if (cfg.mockMode) {
      const updated = commerceMemoryStore.updateStock(
        organizationId,
        id,
        normalized,
      )
      if (!updated) throw new NotFoundException('Commerce product not found')
      return updated
    }

    const current = await this.get(organizationId, id)
    const result = await MedusaHttpClient.fromConfig('admin').post<
      MedusaProductEnvelope
    >(`/admin/products/${encodeURIComponent(id)}`, {
      metadata: { stock: normalized },
    })
    if (!result.ok || !result.data?.product) {
      throw new InternalServerErrorException(
        result.error ?? 'Unable to update Medusa product stock',
      )
    }
    return mapMedusaProductToDto(
      result.data.product,
      this.requireChannel(link),
      current.currencyCode,
    )
  }

  async remove(organizationId: string, id: string) {
    const cfg = getCommerceConfig()
    await this.get(organizationId, id)
    if (cfg.mockMode) {
      commerceMemoryStore.deleteProduct(organizationId, id)
      return { id, deleted: true }
    }
    const result = await MedusaHttpClient.fromConfig('admin').delete(
      `/admin/products/${encodeURIComponent(id)}`,
    )
    if (!result.ok) {
      throw new InternalServerErrorException(
        result.error ?? 'Unable to delete Medusa product',
      )
    }
    return { id, deleted: true }
  }

  private async createOnMedusa(
    organizationId: string,
    input: CreateCommerceProductInput,
    salesChannelId: string,
    currencyCode: string,
  ): Promise<CommerceProductDto> {
    const admin = MedusaHttpClient.fromConfig('admin')
    const images = (input.images ?? []).map((url) => url.trim()).filter(Boolean)
    const sku = input.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`

    const payload = {
      title: input.title.trim(),
      handle: slugify(input.title),
      status: this.toMedusaStatus(input.status ?? 'published'),
      description: input.description?.trim() || undefined,
      subtitle: input.shortDescription?.trim() || undefined,
      thumbnail: images[0] ?? undefined,
      images: images.map((url) => ({ url })),
      sales_channels: [{ id: salesChannelId }],
      options: [{ title: 'Default', values: ['Default'] }],
      variants: [
        {
          title: input.title.trim(),
          sku,
          manage_inventory: false,
          options: { Default: 'Default' },
          prices: [
            {
              amount: input.price,
              currency_code: currencyCode,
            },
          ],
        },
      ],
      metadata: {
        ladipage_organization_id: organizationId,
        sku,
        compare_at_price: input.compareAtPrice ?? 0,
        stock: input.stock ?? 0,
        short_description: input.shortDescription?.trim() || '',
        highlights: (input.highlights ?? []).map((h) => h.trim()).filter(Boolean),
        brand: input.brand?.trim() || '',
        badge: input.badge?.trim() || '',
        unit: input.unit?.trim() || '',
        shipping_note: input.shippingNote?.trim() || '',
      },
    }

    const result = await admin.post<MedusaProductEnvelope>(
      '/admin/products',
      payload,
    )

    if (!result.ok || !result.data?.product) {
      this.logger.error(
        `create product Medusa failed org=${organizationId}: ${result.error ?? result.status}`,
      )
      throw new InternalServerErrorException(
        result.error ?? 'Unable to create Medusa product',
      )
    }

    return mapMedusaProductToDto(
      result.data.product,
      salesChannelId,
      currencyCode,
    )
  }

  /**
   * A live store link must carry a real sales channel id; without it we
   * cannot enforce isolation, so we refuse rather than query unscoped.
   */
  private requireChannel(link: CommerceStoreLinkDto): string {
    if (!link.salesChannelId) {
      throw new ForbiddenException(
        'Store is not provisioned yet (no sales channel). Provision the store first.',
      )
    }
    return link.salesChannelId
  }

  private toMedusaStatus(status: CommerceProductStatus): string {
    if (status === 'draft') return 'draft'
    if (status === 'archived') return 'rejected'
    return 'published'
  }
}
