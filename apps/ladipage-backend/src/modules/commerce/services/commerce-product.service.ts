import {
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
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `product-${Date.now()}`
  )
}

@Injectable()
export class CommerceProductService {
  private readonly logger = new Logger(CommerceProductService.name)

  constructor(private readonly storeService: CommerceStoreService) {}

  async list(organizationId: string): Promise<CommerceProductDto[]> {
    const cfg = getCommerceConfig()
    const link = this.storeService.ensureStore(organizationId)

    if (cfg.mockMode) {
      return commerceMemoryStore.listProducts(organizationId)
    }

    const admin = MedusaHttpClient.fromConfig('admin')
    const result = await admin.get<MedusaProductEnvelope>(
      '/admin/products?limit=100',
    )

    if (!result.ok) {
      this.logger.warn(
        `list products failed org=${organizationId}: ${result.error ?? result.status}`,
      )
      throw new InternalServerErrorException(
        result.error ?? 'Unable to list Medusa products',
      )
    }

    return (result.data?.products ?? []).map((product) =>
      mapMedusaProductToDto(product, link.salesChannelId, link.currencyCode),
    )
  }

  async get(
    organizationId: string,
    id: string,
  ): Promise<CommerceProductDto> {
    const cfg = getCommerceConfig()
    const link = this.storeService.ensureStore(organizationId)

    if (cfg.mockMode) {
      const product = commerceMemoryStore.getProduct(organizationId, id)
      if (!product) throw new NotFoundException('Commerce product not found')
      return product
    }

    const admin = MedusaHttpClient.fromConfig('admin')
    const result = await admin.get<MedusaProductEnvelope>(`/admin/products/${id}`)

    if (!result.ok || !result.data?.product) {
      throw new NotFoundException(result.error ?? 'Commerce product not found')
    }

    return mapMedusaProductToDto(
      result.data.product,
      link.salesChannelId,
      link.currencyCode,
    )
  }

  async create(
    organizationId: string,
    input: CreateCommerceProductInput,
  ): Promise<CommerceProductDto> {
    const cfg = getCommerceConfig()
    const link = this.storeService.ensureStore(organizationId)

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
      link.salesChannelId,
      link.currencyCode,
    )
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: CommerceProductStatus,
  ): Promise<CommerceProductDto> {
    const cfg = getCommerceConfig()
    const link = this.storeService.ensureStore(organizationId)

    if (cfg.mockMode) {
      const updated = commerceMemoryStore.updateStatus(organizationId, id, status)
      if (!updated) throw new NotFoundException('Commerce product not found')
      return updated
    }

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
      link.salesChannelId,
      link.currencyCode,
    )
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

  private toMedusaStatus(status: CommerceProductStatus): string {
    if (status === 'draft') return 'draft'
    if (status === 'archived') return 'rejected'
    return 'published'
  }
}
