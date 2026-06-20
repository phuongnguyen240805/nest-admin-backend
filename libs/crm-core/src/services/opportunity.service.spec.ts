import { TenantContextService } from '@liora/nest-core'

import { CrmActivityService } from './activity.service'
import { CrmOpportunityService } from './opportunity.service'
import { CrmPipelineService } from './pipeline.service'

describe('CrmOpportunityService', () => {
  const tenantId = 1
  const mockTenantContext = {
    getTenantId: jest.fn(() => tenantId),
  } as unknown as TenantContextService

  const mockOppRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  }

  const mockPipelineService = {
    ensureDefaultPipeline: jest.fn(),
    getStageById: jest.fn(),
  } as unknown as CrmPipelineService

  const mockActivityService = {
    log: jest.fn(),
  } as unknown as CrmActivityService

  const mockDataSource = {
    transaction: jest.fn((cb) =>
      cb({
        getRepository: () => ({
          save: jest.fn(async (data) => ({
            id: 'opp-uuid',
            stageId: 'stage-1',
            personId: null,
            ...data,
          })),
          update: jest.fn(),
          findOne: jest.fn(async ({ where }) => ({
            id: where.id,
            name: 'Deal A',
            stageId: 'stage-2',
            personId: 'person-1',
          })),
          softRemove: jest.fn(),
        }),
      }),
    ),
  } as unknown as import('typeorm').DataSource

  let service: CrmOpportunityService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CrmOpportunityService(
      mockTenantContext,
      mockOppRepo as never,
      mockPipelineService,
      mockActivityService,
      mockDataSource,
    )
  })

  it('creates opportunity with default first stage', async () => {
    ;(mockPipelineService.ensureDefaultPipeline as jest.Mock).mockResolvedValue({
      id: 'pipe-1',
      stages: [{ id: 'stage-1', slug: 'new', name: 'New', position: 0 }],
    })

    const result = await service.create({ name: 'Big Deal' })

    expect(result.name).toBe('Big Deal')
    expect(result.stageId).toBe('stage-1')
    expect(mockActivityService.log).toHaveBeenCalled()
  })

  it('moveStage logs STAGE_CHANGED activity', async () => {
    mockOppRepo.findOne.mockResolvedValue({
      id: 'opp-1',
      tenantId,
      name: 'Deal A',
      stageId: 'stage-1',
      personId: 'person-1',
    })
    ;(mockPipelineService.getStageById as jest.Mock).mockResolvedValue({
      id: 'stage-2',
      name: 'Qualified',
    })

    await service.moveStage('opp-1', 'stage-2')

    expect(mockActivityService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STAGE_CHANGED',
        properties: expect.objectContaining({ toStageId: 'stage-2' }),
      }),
      expect.anything(),
    )
  })
})