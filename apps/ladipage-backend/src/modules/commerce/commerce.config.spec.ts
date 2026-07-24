import { getCommerceConfig } from './commerce.config'

describe('getCommerceConfig', () => {
  const env = { ...process.env }

  afterEach(() => {
    process.env = { ...env }
  })

  it('defaults to mock mode when no admin key', () => {
    delete process.env.COMMERCE_MEDUSA_MOCK
    delete process.env.MEDUSA_ADMIN_API_KEY
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    const cfg = getCommerceConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.mockMode).toBe(true)
    expect(cfg.monetize).toBe(false)
  })

  it('auto live when admin key set and MOCK unset', () => {
    delete process.env.COMMERCE_MEDUSA_MOCK
    process.env.MEDUSA_ADMIN_API_KEY = 'sk_test_xxx'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    expect(getCommerceConfig().mockMode).toBe(false)
  })

  it('stays mock when MOCK=true even with key', () => {
    process.env.COMMERCE_MEDUSA_MOCK = 'true'
    process.env.MEDUSA_ADMIN_API_KEY = 'sk_test_xxx'
    expect(getCommerceConfig().mockMode).toBe(true)
  })

  it('can disable commerce', () => {
    process.env.COMMERCE_MEDUSA_ENABLED = 'false'
    expect(getCommerceConfig().enabled).toBe(false)
  })
})

