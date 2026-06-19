/** Order status values — aligned with ladipage-fe sales module */
export type OrderStatus =
  | 'PENDING'
  | 'SHIPPED'
  | 'UNPAID'
  | 'SPAM'
  | 'COMPLETED'

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
  isIncomplete?: boolean
}

export interface ProductItem {
  id: string | number
  name: string
  price: number
  sku: string
  stock?: number
  status?: string
}