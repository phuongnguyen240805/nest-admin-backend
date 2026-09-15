import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { of } from 'rxjs'

import type { TenantContextService } from './tenant-context.service'
import { TenantContextInterceptor } from './tenant-context.interceptor'

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext
}

const next = { handle: () => of(null) } as CallHandler

describe('TenantContextInterceptor', () => {
  it('uses verified user tenant claims instead of browser tenant input', () => {
    const setTenantId = jest.fn()
    const tenantContext = { setTenantId } as unknown as TenantContextService
    const interceptor = new TenantContextInterceptor(tenantContext)
    const request = {
      headers: { 'x-tenant-id': '999' },
      query: { tenantId: '999' },
      user: { activeTenantId: 7, tenantId: 7 },
    }

    interceptor.intercept(contextFor(request), next)

    expect(setTenantId).toHaveBeenCalledWith(7)
    expect(setTenantId).not.toHaveBeenCalledWith(999)
  })

  it('does not create tenant context from untrusted headers/query without a user', () => {
    const setTenantId = jest.fn()
    const tenantContext = { setTenantId } as unknown as TenantContextService
    const interceptor = new TenantContextInterceptor(tenantContext)

    interceptor.intercept(
      contextFor({
        headers: { 'x-tenant-id': '999' },
        query: { tenantId: '999' },
      }),
      next,
    )

    expect(setTenantId).not.toHaveBeenCalled()
  })
})
