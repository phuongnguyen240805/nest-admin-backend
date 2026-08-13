import { ShippingAdapterRegistry } from './shipping-adapter.registry'

describe('ShippingAdapterRegistry', () => {
  it('registers every carrier exposed by the shipping domain', () => {
    const registry = new ShippingAdapterRegistry()

    expect(registry.registeredProviders()).toEqual([
      'ghn',
      'ghtk',
      'viettel_post',
      'jt_express',
      'vnpost',
      'best_express',
      'ahamove',
    ])
  })

  it.each([
    ['viettel_post', 'Viettel Post'],
    ['jt_express', 'J&T Express'],
    ['vnpost', 'VNPost'],
    ['best_express', 'BEST Express'],
    ['ahamove', 'Ahamove'],
  ] as const)('creates the %s production contract adapter', (provider, name) => {
    const adapter = new ShippingAdapterRegistry().create({
      id: 1,
      provider,
      enabled: true,
      credentials: { token: 'secret' },
      settings: { baseUrl: 'https://carrier.example.com', endpoints: { test: '/health' } },
    })

    expect(adapter.provider).toBe(provider)
    expect(adapter.name).toBe(name)
    expect(adapter.getCapabilities()).toMatchObject({
      quote: true,
      createShipment: true,
      cancelShipment: true,
      tracking: true,
    })
  })
})
