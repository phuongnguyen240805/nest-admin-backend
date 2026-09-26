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

  it('does not retry organization_members after schema-cache miss', async () => {
    let memberCalls = 0
    const supabaseService = {
      hasAdminClient: () => true,
      getAdminClient: () => ({
        from: (table: string) => {
          if (table === 'website_pages') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ count: null, error: { message: 'missing' } }),
                }),
              }),
            }
          }
          if (table === 'organization_members') {
            memberCalls += 1
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: "Could not find the table 'public.organization_members' in the schema cache" },
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
    const service = new LandingPageQuotaService(
      supabaseService as never,
      subscriptionService as never,
      planConfigService as never,
      tenantContext as never,
    )
    await expect(service.countPagesForOrganization('org-1')).resolves.toBe(0)
    await expect(service.countPagesForOrganization('org-1')).resolves.toBe(0)
    expect(memberCalls).toBe(1)
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