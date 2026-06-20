import { DEFAULT_PIPELINE_STAGES } from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'

import { CrmPipelineService } from './pipeline.service'

describe('CrmPipelineService', () => {
  const tenantId = 1
  const mockTenantContext = {
    getTenantId: jest.fn(() => tenantId),
  } as unknown as TenantContextService

  const mockPipelineRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  }

  const mockStageRepo = {
    save: jest.fn(),
  }

  let service: CrmPipelineService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CrmPipelineService(
      mockTenantContext,
      mockPipelineRepo as never,
      mockStageRepo as never,
    )
  })

  it('returns existing default pipeline with sorted stages', async () => {
    mockPipelineRepo.findOne.mockResolvedValue({
      id: 'pipe-1',
      tenantId,
      isDefault: true,
      stages: [
        { id: 's2', position: 2, slug: 'proposal' },
        { id: 's1', position: 1, slug: 'qualified' },
      ],
    })

    const result = await service.ensureDefaultPipeline()
    expect(result.stages[0].position).toBe(1)
    expect(mockPipelineRepo.save).not.toHaveBeenCalled()
  })

  it('seeds default pipeline when none exists', async () => {
    mockPipelineRepo.findOne.mockResolvedValue(null)
    mockPipelineRepo.save.mockResolvedValue({
      id: 'pipe-new',
      tenantId,
      name: 'Sales Pipeline',
      isDefault: true,
    })
    mockStageRepo.save.mockImplementation(async (stages) =>
      stages.map((s: { slug: string }, i: number) => ({ id: `stage-${i}`, ...s })),
    )

    const result = await service.ensureDefaultPipeline()

    expect(mockPipelineRepo.save).toHaveBeenCalled()
    expect(mockStageRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ slug: DEFAULT_PIPELINE_STAGES[0].slug }),
      ]),
    )
    expect(result.stages).toHaveLength(DEFAULT_PIPELINE_STAGES.length)
  })
})