/** Customer status — aligned with ladipage-fe customers module */
export type CustomerStatus = 'ACTIVE' | 'BLOCKED'

/** FE-compatible customer list item (khach-hang page) */
export interface CustomerItem {
  id: string | number
  name: string
  phone: string
  email: string
  status: CustomerStatus
  createdAt: string | Date
  segment?: string
  tags: string[]
}

export interface CompanyItem {
  id: string | number
  name: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface SegmentItem {
  id: string | number
  name: string
  isDefault: boolean
  customerCount: number
  createdAt: string | Date
  updatedAt: string | Date
}

export interface TagItem {
  id: string | number
  name: string
  count: number
  createdAt: string | Date
  updatedAt: string | Date
}

export type CustomFieldType =
  | 'Chữ'
  | 'Số'
  | 'Ngày tháng'
  | 'Danh sách'
  | 'Đúng/Sai'
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'LIST'
  | 'BOOLEAN'

export interface CustomFieldItem {
  id: string | number
  displayName: string
  fieldName: string
  dataType: CustomFieldType
  description: string
}

export interface ErrorLogItem {
  id: string | number
  time: string | Date
  errorCode: string
  customer: string
  actionType: string
  errorContent: string
}