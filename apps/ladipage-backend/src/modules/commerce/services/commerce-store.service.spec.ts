import { CommerceStoreService } from './commerce-store.service'
import { commerceMemoryStore } from './commerce-memory.store'

describe('CommerceStoreService', () => {
  let service: CommerceStoreService

  beforeEach(() => {
    commerceMemoryStore.reset()
    service = new CommerceStoreService()
  })

  it('returns mock health when mock mode', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'true'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    const health = await service.health()
    expect(health.enabled).toBe(true)
    expect(health.mockMode).toBe(true)
    expect(health.message).toContain('MOCK MODE')
  })

  it('returns live health when mockMode=false and key set', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'false'
    process.env.MEDUSA_ADMIN_API_KEY = 'sk_test'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    const health = await service.health()
    expect(health.enabled).toBe(true)
    expect(health.mockMode).toBe(false)
    expect(health.message).toContain('LIVE')
  })

  it('ensures store link for org', () => {
    const link = service.ensureStore('org-demo')
    expect(link.salesChannelId).toContain('sc_lp_')
    expect(link.status).toBe('active')
  })

  it('creates storefront session', () => {
    const session = service.createStorefrontSession('org-demo', 'page-1')
    expect(session.salesChannelId).toBeTruthy()
    expect(session.pageId).toBe('page-1')
    expect(session.regionId).toBeTruthy()
  })
})
