import { Injectable, Scope } from '@nestjs/common'
import { ClsService, ClsStore } from 'nestjs-cls'

import { Organization } from '~/modules/billing/entities/organization.entity'

export const TENANT_CONTEXT_KEY = 'tenantId' as const
export const ORGANIZATION_ID_CONTEXT_KEY = 'organizationId' as const

export interface TenantRequestContext {
  tenantId: number
  organizationId: string
  organization?: Organization
}

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  constructor(private readonly cls: ClsService<ClsStore>) {}

  setContext(ctx: TenantRequestContext): void {
    this.cls.set(TENANT_CONTEXT_KEY, ctx.tenantId)
    this.cls.set(ORGANIZATION_ID_CONTEXT_KEY, ctx.organizationId)
  }

  setTenantId(tenantId: number): void {
    this.cls.set(TENANT_CONTEXT_KEY, tenantId)
  }

  setOrganizationId(organizationId: string): void {
    this.cls.set(ORGANIZATION_ID_CONTEXT_KEY, organizationId)
  }

  getTenantId(): number | undefined {
    return this.cls.get(TENANT_CONTEXT_KEY)
  }

  getOrganizationId(): string | undefined {
    return this.cls.get(ORGANIZATION_ID_CONTEXT_KEY)
  }

  /**
   * True when both tenantId and organizationId are available in CLS.
   */
  isReady(): boolean {
    return this.getTenantId() != null && !!this.getOrganizationId()
  }

  getCurrentTenant(): { id: number } | null {
    const tenantId = this.getTenantId()
    return tenantId != null ? { id: tenantId } : null
  }

  clear(): void {
    this.cls.set(TENANT_CONTEXT_KEY, undefined)
    this.cls.set(ORGANIZATION_ID_CONTEXT_KEY, undefined)
  }
}