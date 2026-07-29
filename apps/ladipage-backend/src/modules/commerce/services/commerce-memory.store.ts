import type {
  CommerceOrderDto,
  CommerceProductDto,
  CommerceStoreLinkDto,
  CreateCommerceProductInput,
} from '../types/commerce.types'

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

/**
 * In-process store for mock mode (COMMERCE_MEDUSA_MOCK default true).
 * Keyed by organizationId for multi-tenant isolation tests.
 */
export class CommerceMemoryStore {
  private readonly links = new Map<string, CommerceStoreLinkDto>()
  private readonly products = new Map<string, CommerceProductDto[]>()
  private readonly orders = new Map<string, CommerceOrderDto[]>()

  ensureLink(
    organizationId: string,
    opts: { regionId: string; currencyCode: string; publishableKey: string },
  ): CommerceStoreLinkDto {
    const existing = this.links.get(organizationId)
    if (existing) return existing

    const channelId = `sc_lp_${organizationId.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24)}`
    const link: CommerceStoreLinkDto = {
      ladipageOrganizationId: organizationId,
      medusaOrganizationId: null,
      salesChannelId: channelId,
      salesChannelName: `LadiPage — ${organizationId}`,
      regionId: opts.regionId,
      currencyCode: opts.currencyCode,
      status: 'active',
      healthMessage: 'Mock store link (no live Medusa)',
      provisionedAt: new Date().toISOString(),
      publishableKeyPreview: opts.publishableKey
        ? `${opts.publishableKey.slice(0, 8)}…`
        : 'mock_pk',
    }
    this.links.set(organizationId, link)
    if (!this.products.has(organizationId)) {
      this.products.set(organizationId, this.seedProducts(channelId))
    }
    if (!this.orders.has(organizationId)) {
      this.orders.set(organizationId, this.seedOrders())
    }
    return link
  }

  getLink(organizationId: string): CommerceStoreLinkDto | null {
    return this.links.get(organizationId) ?? null
  }

  setLink(organizationId: string, link: CommerceStoreLinkDto): void {
    this.links.set(organizationId, link)
  }

  /**
   * Lazily seed a mock catalog/orders for an org on first access. In live mode
   * the memory store is never touched; in mock mode this keeps the FE testable
   * without a running Medusa or a provisioned link.
   */
  private ensureSeed(organizationId: string): void {
    if (!this.products.has(organizationId)) {
      const channelId = `sc_mock_lp_${organizationId.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24)}`
      this.products.set(organizationId, this.seedProducts(channelId))
    }
    if (!this.orders.has(organizationId)) {
      this.orders.set(organizationId, this.seedOrders())
    }
  }

  listProducts(organizationId: string): CommerceProductDto[] {
    this.ensureSeed(organizationId)
    return [...(this.products.get(organizationId) ?? [])].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }

  createProduct(
    organizationId: string,
    input: CreateCommerceProductInput,
    channelId: string,
    currencyCode: string,
  ): CommerceProductDto {
    const now = new Date().toISOString()
    const images = (input.images ?? []).map((u) => u.trim()).filter(Boolean)
    const product: CommerceProductDto = {
      id: `prod_${Date.now().toString(36)}`,
      title: input.title.trim(),
      handle: slugify(input.title),
      sku: input.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      status: input.status ?? 'published',
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? 0,
      currencyCode,
      stock: input.stock ?? 0,
      thumbnailUrl: images[0] ?? null,
      images,
      shortDescription: input.shortDescription?.trim() || '',
      description: input.description?.trim() || '',
      highlights: (input.highlights ?? []).map((h) => h.trim()).filter(Boolean),
      brand: input.brand?.trim() || '',
      badge: input.badge?.trim() || '',
      unit: input.unit?.trim() || '',
      shippingNote: input.shippingNote?.trim() || '',
      salesChannelId: channelId,
      createdAt: now,
      updatedAt: now,
    }
    const list = this.products.get(organizationId) ?? []
    list.unshift(product)
    this.products.set(organizationId, list)
    return product
  }

  getProduct(organizationId: string, id: string): CommerceProductDto | null {
    return this.listProducts(organizationId).find((p) => p.id === id) ?? null
  }

  updateStatus(
    organizationId: string,
    id: string,
    status: CommerceProductDto['status'],
  ): CommerceProductDto | null {
    const list = this.products.get(organizationId)
    if (!list) return null
    const idx = list.findIndex((p) => p.id === id)
    if (idx < 0) return null
    list[idx] = {
      ...list[idx],
      status,
      updatedAt: new Date().toISOString(),
    }
    return list[idx]
  }

  updateStock(
    organizationId: string,
    id: string,
    stock: number,
  ): CommerceProductDto | null {
    const list = this.products.get(organizationId)
    if (!list) return null
    const idx = list.findIndex(product => product.id === id)
    if (idx < 0) return null
    list[idx] = {
      ...list[idx],
      stock: Math.max(0, Math.trunc(stock)),
      updatedAt: new Date().toISOString(),
    }
    return list[idx]
  }

  deleteProduct(organizationId: string, id: string): boolean {
    const list = this.products.get(organizationId)
    if (!list) return false
    const next = list.filter(product => product.id !== id)
    if (next.length === list.length) return false
    this.products.set(organizationId, next)
    return true
  }

  listOrders(organizationId: string): CommerceOrderDto[] {
    this.ensureSeed(organizationId)
    return [...(this.orders.get(organizationId) ?? [])]
  }

  private seedProducts(channelId: string): CommerceProductDto[] {
    const now = new Date().toISOString()
    return [
      {
        id: 'prod_01SERUM',
        title: 'Serum Vitamin C 30ml',
        handle: 'serum-vitamin-c-30ml',
        sku: 'SERUM-VC-30',
        status: 'published',
        price: 299000,
        compareAtPrice: 399000,
        currencyCode: 'vnd',
        stock: 120,
        thumbnailUrl: '/images/product/skincare_product.png',
        images: ['/images/product/skincare_product.png'],
        shortDescription: 'Serum dưỡng sáng, mờ thâm.',
        description: 'Serum Vitamin C 30ml — mock seed BE.',
        highlights: ['Vitamin C 15%', 'Không paraben'],
        brand: 'Ladi Care',
        badge: 'Bán chạy',
        unit: 'chai',
        shippingNote: 'Giao 2–4 ngày',
        salesChannelId: channelId,
        createdAt: now,
        updatedAt: now,
      },
    ]
  }

  private seedOrders(): CommerceOrderDto[] {
    return [
      {
        id: 'order_mock_1',
        displayId: '#1001',
        email: 'minh@gmail.com',
        customerName: 'Minh Nguyen',
        total: 299000,
        currencyCode: 'vnd',
        status: 'completed',
        landingPageId: 'page_flash_sale_serum',
        landingPageName: 'Flash Sale Serum',
        itemsSummary: 'Serum Vitamin C 30ml × 1',
        createdAt: new Date().toISOString(),
      },
    ]
  }

  /** test helper */
  reset() {
    this.links.clear()
    this.products.clear()
    this.orders.clear()
  }
}

export const commerceMemoryStore = new CommerceMemoryStore()
