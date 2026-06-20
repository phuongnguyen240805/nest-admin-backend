import { ForbiddenException } from '@nestjs/common'

import { TenantContextService } from '@liora/nest-core'

import { CrmObjectDefinitionService } from './object-definition.service'

describe('CrmObjectDefinitionService', () => {
  const mockTenantContext = {
    getTenantId: jest.fn(() => 1),
  } as unknown as TenantContextService

  const mockObjectRepo = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    save: jest.fn(async (d) => ({ id: 'obj-uuid', ...d })),
    findOne: jest.fn(),
    softRemove: jest.fn(),
  }

  const mockFieldRepo = {
    find: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  }

  let service: CrmObjectDefinitionService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CrmObjectDefinitionService(
      mockTenantContext,
      mockObjectRepo as never,
      mockFieldRepo as never,
    )
  })

  describe('assertObjectQuota', () => {
    it('blocks free tier', async () => {
      await expect(service.assertObjectQuota('free')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('blocks when enterprise limit reached', async () => {
      mockObjectRepo.count.mockResolvedValue(10)
      await expect(service.assertObjectQuota('enterprise')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('allows lifetime unlimited', async () => {
      mockObjectRepo.count.mockResolvedValue(100)
      await expect(service.assertObjectQuota('lifetime')).resolves.toBeUndefined()
    })
  })
})