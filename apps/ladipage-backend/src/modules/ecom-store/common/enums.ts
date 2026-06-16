export enum OrderStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  UNPAID = 'UNPAID',
  SPAM = 'SPAM',
  COMPLETED = 'COMPLETED',
}

export enum EcomEntityType {
  ORDER = 'order',
  PRODUCT = 'product',
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
}

export enum CustomFieldDataType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  LIST = 'LIST',
  BOOLEAN = 'BOOLEAN',
}