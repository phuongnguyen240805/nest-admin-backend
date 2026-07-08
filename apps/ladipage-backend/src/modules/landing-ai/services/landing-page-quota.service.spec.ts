import { HttpException } from '@nestjs/common'

import { LandingPageQuotaService } from './landing-page-quota.service'

describe('LandingPageQuotaService', () => {
  const subscriptionService = {
    getOrCreateSubscription: jest.fn().mockResolvedValue({ subscriptionTier: 'free' }),
  }
  const planConfigService = {
    getLimitsForTier: jest.fn().mockReturnValue({ pages: 3, domains: 1, credits: 100 }),
  }
  const tenantContext = {
    getOrganizationId: jest.fn().mockReturnValue('org-1'),
  }

  function createService(count = 0) {
    const supabaseService = {
      hasAdminClient: () => true,
      getAdminClient: () => ({
        from: (table: string) => {
          if (table === 'website_pages') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ count, error: null }),
                }),
              }),
            }
          }
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }
        },
      }),
    }

    return new LandingPageQuotaService(
      supabaseService as never,
      subscriptionService as never,
      planConfigService as never,
      tenantContext as never,
    )
  }

  it('allows create when under quota', async () => {
    const service = createService(2)
    await expect(service.assertCanCreatePage('org-1', 'job-1')).resolves.toBeUndefined()
    service.releaseSlot('org-1', 'job-1')
  })

  it('throws 429 when quota exceeded', async () => {
    const service = createService(3)
    await expect(service.assertCanCreatePage('org-1', 'job-1')).rejects.toBeInstanceOf(HttpException)
  })

  it('treats enterprise limit -1 as unlimited', async () => {
    planConfigService.getLimitsForTier.mockReturnValueOnce({
      pages: -1,
      domains: -1,
      credits: 10000,
    })
    const service = createService(999)
    await expect(service.assertCanCreatePage('org-1', 'job-1')).resolves.toBeUndefined()
    service.releaseSlot('org-1', 'job-1')
  })
})