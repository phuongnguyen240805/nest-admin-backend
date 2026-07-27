import { CommerceStoreService } from './commerce-store.service'
import type { CommerceStoreLinkService } from './commerce-store-link.service'
import type { MedusaProvisioningService } from './medusa-provisioning.service'
import type { CommerceStoreLinkEntity } from '../entities'

function makeEntity(
  patch: Partial<CommerceStoreLinkEntity> = {},
): CommerceStoreLinkEntity {
  return {
    organizationId: 'org-demo',
    mode: 'hosted_shared',
    salesChannelId: 'sc_123',
    salesChannelName: 'LadiPage — org-demo',
    publishableKeyId: null,
    publishableKeyPreview: null,
    regionId: 'reg_vn',
    currencyCode: 'vnd',
    status: 'active',
    healthMessage: null,
    provisionedAt: new Date(),
    lastHealthCheckAt: null,
    ...patch,
  } as CommerceStoreLinkEntity
}

describe('CommerceStoreService', () => {
  const env = { ...process.env }
  let links: jest.Mocked<Pick<CommerceStoreLinkService, 'findByOrg' | 'upsert'>>
  let provisioning: jest.Mocked<Pick<MedusaProvisioningService, 'provision'>>
  let service: CommerceStoreService

  beforeEach(() => {
    links = {
      findByOrg: jest.fn(),
      upsert: jest.fn(),
    }
    provisioning = {
      provision: jest.fn(),
    }
    service = new CommerceStoreService(
      links as unknown as CommerceStoreLinkService,
      provisioning as unknown as MedusaProvisioningService,
    )
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('returns mock health when mock mode', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'true'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    const health = await service.health()
    expect(health.enabled).toBe(true)
    expect(health.mockMode).toBe(true)
    expect(health.message).toContain('MOCK MODE')
  })

  it('provisions a mock store link on first use', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'true'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    links.findByOrg.mockResolvedValue(null)
    links.upsert.mockImplementation(async (_org, patch) =>
      makeEntity(patch as Partial<CommerceStoreLinkEntity>),
    )

    const link = await service.ensureStore('org-demo')
    expect(links.upsert).toHaveBeenCalled()
    expect(link.status).toBe('active')
    expect(link.salesChannelId).toBeTruthy()
    // Mock mode must never call the live provisioner.
    expect(provisioning.provision).not.toHaveBeenCalled()
  })

  it('reuses an already-active link without re-provisioning', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'false'
    process.env.MEDUSA_ADMIN_API_KEY = 'sk_test'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    links.findByOrg.mockResolvedValue(makeEntity())

    const link = await service.ensureStore('org-demo')
    expect(link.salesChannelId).toBe('sc_123')
    expect(provisioning.provision).not.toHaveBeenCalled()
    expect(links.upsert).not.toHaveBeenCalled()
  })

  it('provisions a real channel in live mode when no active link exists', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'false'
    process.env.MEDUSA_ADMIN_API_KEY = 'sk_test'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    links.findByOrg.mockResolvedValue(null)
    provisioning.provision.mockResolvedValue({
      salesChannelId: 'sc_live',
      salesChannelName: 'lp_org-demo',
      publishableKeyId: 'apk_1',
      publishableKeyPreview: 'pk_1234…',
      regionId: 'reg_live',
    })
    links.upsert.mockImplementation(async (_org, patch) =>
      makeEntity(patch as Partial<CommerceStoreLinkEntity>),
    )

    const link = await service.ensureStore('org-demo')
    expect(provisioning.provision).toHaveBeenCalledWith('org-demo')
    expect(link.salesChannelId).toBe('sc_live')
    expect(link.status).toBe('active')
  })

  it('persists an error link when live provisioning fails', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'false'
    process.env.MEDUSA_ADMIN_API_KEY = 'sk_test'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    links.findByOrg.mockResolvedValue(null)
    provisioning.provision.mockRejectedValue(new Error('medusa down'))
    links.upsert.mockImplementation(async (_org, patch) =>
      makeEntity(patch as Partial<CommerceStoreLinkEntity>),
    )

    const link = await service.ensureStore('org-demo')
    expect(link.status).toBe('error')
    expect(link.healthMessage).toContain('medusa down')
  })

  it('creates a storefront session from the store link', async () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'true'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    links.findByOrg.mockResolvedValue(makeEntity())

    const session = await service.createStorefrontSession('org-demo', 'page-1')
    expect(session.salesChannelId).toBe('sc_123')
    expect(session.pageId).toBe('page-1')
    expect(session.regionId).toBeTruthy()
  })
})
