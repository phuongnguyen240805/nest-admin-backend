import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { Repository } from 'typeorm'

import type { TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from './tenant-scoped.service'

type Row = { id: number; tenantId: number }

class TenantScopedHarness extends TenantScopedService {
  where(extra?: Partial<Row>) {
    return this.tenantWhere<Row>(extra as never)
  }

  assertIds(repository: Repository<Row>, ids: number[]) {
    return this.assertTenantOwnedIds(repository, ids, 'Related resource not found')
  }
}

describe('TenantScopedService', () => {
  it('never lets caller criteria override the authenticated tenant', () => {
    const tenantContext = {
      getTenantId: () => 7,
    } as unknown as TenantContextService
    const service = new TenantScopedHarness(tenantContext)

    expect(service.where({ id: 12, tenantId: 999 })).toMatchObject({
      id: 12,
      tenantId: 7,
    })
  })

  it('rejects missing tenant context', () => {
    const tenantContext = {
      getTenantId: () => undefined,
    } as unknown as TenantContextService
    const service = new TenantScopedHarness(tenantContext)

    expect(() => service.where({ id: 1 })).toThrow(ForbiddenException)
  })

  it('rejects relation ids unless every id belongs to the tenant', async () => {
    const tenantContext = {
      getTenantId: () => 7,
    } as unknown as TenantContextService
    const service = new TenantScopedHarness(tenantContext)
    const repository = {
      count: jest.fn().mockResolvedValue(1),
    } as unknown as Repository<Row>

    await expect(service.assertIds(repository, [1, 2])).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(repository.count).toHaveBeenCalledTimes(1)
    expect(repository.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 7 }),
      }),
    )
  })

  it('accepts relation ids when all belong to the tenant', async () => {
    const tenantContext = {
      getTenantId: () => 7,
    } as unknown as TenantContextService
    const service = new TenantScopedHarness(tenantContext)
    const repository = {
      count: jest.fn().mockResolvedValue(2),
    } as unknown as Repository<Row>

    await expect(service.assertIds(repository, [1, 2])).resolves.toBeUndefined()
  })
})
