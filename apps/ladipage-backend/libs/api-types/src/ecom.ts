/** Order status values — aligned with ladipage-fe sales module */
export type OrderStatus =
  | 'PENDING'
  | 'SHIPPED'
  | 'UNPAID'
  | 'SPAM'
  | 'COMPLETED'

export type EcomEntityType = 'order' | 'product'

export type CustomFieldDataType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'LIST'
  | 'BOOLEAN'

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT'

/** FE-compatible order list item (ban-hang page) */
export interface OrderItem {
  id: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  productName: string
  quantity: number
  totalPrice: number
  status: OrderStatus
  createdAt: string | Date
  orderId?: number
  customerId?: number | null
  personId?: string | null
  source?: string
  assigneeId?: string
  assigneeName?: string
  isIncomplete?: boolean
}

export interface ProductItem {
  id: string | number
  name: string
  price: number
  sku: string
  stock?: number
  status?: ProductStatus | string
  type?: string
  typeName?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface EcomTagItem {
  id: number
  name: string
  color?: string
  count: number
  createdAt: string | Date
  updatedAt: string | Date
}

export interface EcomCustomFieldItem {
  id: number
  entityType: EcomEntityType
  fieldName: string
  displayName: string
  dataType: CustomFieldDataType
  description?: string | null
  options?: string[] | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface EcomCategoryItem {
  id: number
  name: string
  parentId: number | null
  imageUrl?: string | null
  visible: boolean
  productCount: number
  createdAt: string | Date
  updatedAt: string | Date
}

export interface EcomReviewItem {
  id: number
  productId: number
  productName?: string
  productNames: string[]
  rating: number
  content?: string | null
  reviewerName?: string | null
  avatarUrl?: string | null
  imageUrls?: string[] | null
  createdAt: string | Date
  updatedAt: string | Date
}
