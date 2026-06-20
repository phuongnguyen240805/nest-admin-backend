import { TenantContextService } from '@liora/nest-core'

import { CrmActivityService } from './activity.service'

describe('CrmActivityService', () => {
  const mockTenantContext = {
    getTenantId: jest.fn(() => 1),
  } as unknown as TenantContextService

  const mockRepo = {
    save: jest.fn(async (data) => ({ id: 'act-1', ...data })),
    createQueryBuilder: jest.fn(),
  }

  let service: CrmActivityService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CrmActivityService(mockTenantContext, mockRepo as never)
  })

  it('logs activity with tenant scope', async () => {
    const result = await service.log({
      name: 'Person created: Test',
      action: 'CREATED',
      targetType: 'person',
      targetId: 'person-uuid',
      personId: 'person-uuid',
    })

    expect(result.tenantId).toBe(1)
    expect(result.action).toBe('CREATED')
    expect(mockRepo.save).toHaveBeenCalled()
  })
})