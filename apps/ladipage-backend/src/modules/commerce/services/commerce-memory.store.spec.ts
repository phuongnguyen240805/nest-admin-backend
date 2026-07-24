import { commerceMemoryStore } from './commerce-memory.store'

describe('CommerceMemoryStore', () => {
  beforeEach(() => {
    commerceMemoryStore.reset()
  })

  it('provisions isolated store links per organization', () => {
    const a = commerceMemoryStore.ensureLink('org-a', {
      regionId: 'reg_01_vn',
      currencyCode: 'vnd',
      publishableKey: 'pk_test',
    })
    const b = commerceMemoryStore.ensureLink('org-b', {
      regionId: 'reg_01_vn',
      currencyCode: 'vnd',
      publishableKey: 'pk_test',
    })
    expect(a.salesChannelId).not.toBe(b.salesChannelId)
    expect(a.ladipageOrganizationId).toBe('org-a')
    expect(a.status).toBe('active')
  })

  it('creates and lists products per org', () => {
    commerceMemoryStore.ensureLink('org-1', {
      regionId: 'reg_01_vn',
      currencyCode: 'vnd',
      publishableKey: 'pk',
    })
    const created = commerceMemoryStore.createProduct(
      'org-1',
      {
        title: 'Test Kit',
        price: 100000,
        stock: 5,
        images: ['/img.png'],
        highlights: ['A'],
      },
      'sc_test',
      'vnd',
    )
    expect(created.title).toBe('Test Kit')
    expect(created.thumbnailUrl).toBe('/img.png')
    const list = commerceMemoryStore.listProducts('org-1')
    expect(list.some((p) => p.id === created.id)).toBe(true)
    expect(commerceMemoryStore.listProducts('org-other')).toHaveLength(0)
  })

  it('updates product status', () => {
    commerceMemoryStore.ensureLink('org-1', {
      regionId: 'reg_01_vn',
      currencyCode: 'vnd',
      publishableKey: 'pk',
    })
    const p = commerceMemoryStore.createProduct(
      'org-1',
      { title: 'X', price: 1 },
      'sc',
      'vnd',
    )
    const updated = commerceMemoryStore.updateStatus('org-1', p.id, 'draft')
    expect(updated?.status).toBe('draft')
  })
})
