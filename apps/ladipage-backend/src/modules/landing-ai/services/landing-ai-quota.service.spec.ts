import { HttpException } from '@nestjs/common'

import { LandingAiQuotaService } from './landing-ai-quota.service'

describe('LandingAiQuotaService', () => {
  const jobStore = {
    countJobsForUser: jest.fn(),
  }

  function createService(limit = '5') {
    const configService = {
      get: jest.fn((key: string) => (key === 'LANDING_AI_JOBS_PER_USER' ? limit : undefined)),
    }
    return new LandingAiQuotaService(jobStore as never, configService as never)
  }

  beforeEach(() => {
    jobStore.countJobsForUser.mockReset()
  })

  it('allows create when under per-user limit', async () => {
    jobStore.countJobsForUser.mockResolvedValue(4)
    const service = createService()
    await expect(service.assertCanCreateAiJob('42', 'job-1')).resolves.toBeUndefined()
    service.releaseSlot('42', 'job-1')
  })

  it('throws 429 when per-user limit reached', async () => {
    jobStore.countJobsForUser.mockResolvedValue(5)
    const service = createService()
    await expect(service.assertCanCreateAiJob('42', 'job-1')).rejects.toBeInstanceOf(HttpException)
  })

  it('treats limit <= 0 as unlimited', async () => {
    jobStore.countJobsForUser.mockResolvedValue(100)
    const service = createService('0')
    await expect(service.assertCanCreateAiJob('42', 'job-1')).resolves.toBeUndefined()
    service.releaseSlot('42', 'job-1')
  })
})