import type { CommerceProductDto } from '../types/commerce.types'

/** Loose Medusa Admin product JSON (v2). */
export type MedusaAdminProduct = {
  id?: string
  title?: string
  handle?: string
  status?: string
  description?: string
  subtitle?: string
  thumbnail?: string | null
  images?: Array<{ url?: string }>
  metadata?: Record<string, unknown> | null
  variants?: Array<{
    id?: string
    sku?: string | null
    title?: string
    prices?: Array<{ amount?: number; currency_code?: string }>
    inventory_quantity?: number
  }>
  created_at?: string
  updated_at?: string
  sales_channels?: Array<{ id?: string }>
}

function metaString(meta: Record<string, unknown> | null | undefined, key: string): string {
  const v = meta?.[key]
  return typeof v === 'string' ? v : ''
}

function metaStringArray(meta: Record<string, unknown> | null | undefined, key: string): string[] {
  const v = meta?.[key]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}

export function mapMedusaProductToDto(
  product: MedusaAdminProduct,
  fallbackChannelId: string,
  fallbackCurrency: string,
): CommerceProductDto {
  const variant = product.variants?.[0]
  const priceRow = variant?.prices?.[0]
  const images = (product.images ?? [])
    .map((i) => i.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
  const thumb = product.thumbnail || images[0] || null
  const meta = product.metadata ?? {}
  const statusRaw = (product.status ?? 'published').toLowerCase()
  const status =
    statusRaw === 'draft' || statusRaw === 'proposed'
      ? 'draft'
      : statusRaw === 'rejected'
        ? 'archived'
        : 'published'

  return {
    id: product.id ?? `unknown_${Date.now()}`,
    title: product.title ?? 'Untitled',
    handle: product.handle ?? '',
    sku: variant?.sku || metaString(meta, 'sku') || '',
    status,
    price: Number(priceRow?.amount ?? 0),
    compareAtPrice: Number(meta.compare_at_price ?? 0) || 0,
    currencyCode: (priceRow?.currency_code ?? fallbackCurrency).toLowerCase(),
    stock: Number(variant?.inventory_quantity ?? meta.stock ?? 0) || 0,
    thumbnailUrl: thumb,
    images: images.length ? images : thumb ? [thumb] : [],
    shortDescription:
      metaString(meta, 'short_description') || product.subtitle || '',
    description: product.description || '',
    highlights: metaStringArray(meta, 'highlights'),
    brand: metaString(meta, 'brand'),
    badge: metaString(meta, 'badge'),
    unit: metaString(meta, 'unit'),
    shippingNote: metaString(meta, 'shipping_note'),
    salesChannelId:
      product.sales_channels?.[0]?.id || fallbackChannelId,
    createdAt: product.created_at ?? new Date().toISOString(),
    updatedAt: product.updated_at ?? new Date().toISOString(),
  }
}
