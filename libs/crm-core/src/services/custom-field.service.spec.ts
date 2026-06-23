import { ForbiddenException } from '@nestjs/common'

import { TenantContextService } from '@liora/nest-core'

import { CrmCustomFieldService } from './custom-field.service'

describe('CrmCustomFieldService', () => {
  const mockTenantContext = {
    getTenantId: jest.fn(() => 1),
  } as unknown as TenantContextService

  const mockDefRepo = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    save: jest.fn(async (d) => ({ id: 'field-uuid', ...d })),
    findOne: jest.fn(),
    softRemove: jest.fn(),
  }

  const mockValueRepo = {
    delete: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  }

  let service: CrmCustomFieldService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CrmCustomFieldService(
      mockTenantContext,
      mockDefRepo as never,
      mockValueRepo as never,
    )
  })

  describe('assertQuota', () => {
    it('allows free tier under limit', async () => {
      mockDefRepo.count.mockResolvedValue(5)
      await expect(service.assertQuota('free')).resolves.toBeUndefined()
    })

    it('blocks free tier when limit reached', async () => {
      mockDefRepo.count.mockResolvedValue(10)
      await expect(service.assertQuota('free')).rejects.toThrow(ForbiddenException)
    })

    it('blocks when pro limit reached', async () => {
      mockDefRepo.count.mockResolvedValue(20)
      await expect(service.assertQuota('pro')).rejects.toThrow(ForbiddenException)
    })

    it('allows enterprise unlimited', async () => {
      mockDefRepo.count.mockResolvedValue(100)
      await expect(service.assertQuota('enterprise')).resolves.toBeUndefined()
    })
  })
})