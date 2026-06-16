/** JWT / request tenant context shared between backend and frontend */
export interface TenantJwtContext {
  organizationId?: string;
  tenantId?: number;
  activeTenantId?: number;
}

/** Standard paginated list wrapper */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}