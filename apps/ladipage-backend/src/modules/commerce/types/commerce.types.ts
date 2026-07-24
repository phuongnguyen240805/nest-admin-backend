export type CommerceProductStatus = 'published' | 'draft' | 'archived'

export type CommerceProductDto = {
  id: string
  title: string
  handle: string
  sku: string
  status: CommerceProductStatus
  price: number
  compareAtPrice: number
  currencyCode: string
  stock: number
  thumbnailUrl: string | null
  images: string[]
  shortDescription: string
  description: string
  highlights: string[]
  brand: string
  badge: string
  unit: string
  shippingNote: string
  salesChannelId: string
  createdAt: string
  updatedAt: string
}

export type CreateCommerceProductInput = {
  title: string
  sku?: string
  price: number
  compareAtPrice?: number
  stock?: number
  shortDescription?: string
  description?: string
  images?: string[]
  highlights?: string[]
  brand?: string
  badge?: string
  unit?: string
  shippingNote?: string
  status?: CommerceProductStatus
}

export type CommerceStoreLinkDto = {
  ladipageOrganizationId: string
  medusaOrganizationId: string | null
  salesChannelId: string
  salesChannelName: string
  regionId: string
  currencyCode: string
  status: 'pending' | 'active' | 'error'
  healthMessage?: string
  provisionedAt: string | null
  publishableKeyPreview?: string
}

export type CommerceOrderDto = {
  id: string
  displayId: string
  email: string
  customerName: string
  total: number
  currencyCode: string
  status: string
  landingPageId: string | null
  landingPageName: string | null
  itemsSummary: string
  createdAt: string
}

export type CommerceHealthDto = {
  enabled: boolean
  mockMode: boolean
  monetize: boolean
  medusaBaseUrl: string
  medusaReachable: boolean
  message: string
  lastError?: string
  lastStatus?: number
  baseUrlUsed?: string
  candidatesTried?: string[]
}

export type StorefrontSessionDto = {
  mockMode: boolean
  medusaBaseUrl: string
  publishableKey: string
  salesChannelId: string
  regionId: string
  currencyCode: string
  pageId?: string
}
