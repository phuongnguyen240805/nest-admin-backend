import { BadRequestException } from '@nestjs/common'

import { CloudflareSaasService } from './cloudflare-saas.service'

describe('CloudflareSaasService', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.CLOUDFLARE_API_TOKEN
    process.env.LANDING_CUSTOM_DOMAIN_EDGE_ENABLED = 'true'
    process.env.CUSTOM_DOMAIN_CNAME_TARGET = 'ladipage.publicvm.com'
    process.env.LANDING_FREE_SUBDOMAIN_ENABLED = 'true'
    process.env.FREE_SITE_DOMAIN = 'ladipage.publicvm.com'
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('rejects invalid hostname', () => {
    const service = new CloudflareSaasService()
    expect(() => service.createCustomHostname('not-a-domain')).toThrow(/Invalid domain hostname/)
  })

  it('creates local-pending stub without CF credentials (publicvm test mode)', async () => {
    const service = new CloudflareSaasService()
    const record = await service.createCustomHostname('shop.ladipage.publicvm.com')

    expect(record.localStub).toBe(true)
    expect(record.hostname).toBe('shop.ladipage.publicvm.com')
    expect(record.id).toMatch(/^local-pending-/)
    expect(record.cnameTarget).toBe('ladipage.publicvm.com')
    expect(record.edgeEnabled).toBe(true)
    expect(record.domainStatus).toBe('PENDING')
  })

  it('getEdgeFlags reflects free + custom domain test config', () => {
    const service = new CloudflareSaasService()
    const flags = service.getEdgeFlags()
    expect(flags.customDomainEdgeEnabled).toBe(true)
    expect(flags.freeSubdomainEnabled).toBe(true)
    expect(flags.freeSiteDomain).toBe('ladipage.publicvm.com')
    expect(flags.cnameTarget).toBe('ladipage.publicvm.com')
    expect(flags.saasConfigured).toBe(false)
  })

  it('delete local-pending is no-op success', async () => {
    const service = new CloudflareSaasService()
    const result = await service.deleteCustomHostname('local-pending-shop-test')
    expect(result.deleted).toBe(true)
    expect(result.localStub).toBe(true)
  })
})
