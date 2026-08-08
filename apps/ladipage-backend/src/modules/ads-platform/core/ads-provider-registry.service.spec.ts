import type { AdsProviderPlugin } from '@liora/ads-contracts'

import { AdsProviderRegistry } from './ads-provider-registry.service'

describe('AdsProviderRegistry', () => {
  const metaPlugin: AdsProviderPlugin = {
    manifest: {
      provider: 'META',
      version: 'test',
      canonicalSource: 'OFFICIAL_API',
      capabilities: ['CONNECTION', 'PUBLISH'],
    },
  }

  it('registers and resolves provider capabilities', () => {
    const registry = new AdsProviderRegistry()
    registry.register(metaPlugin)

    expect(registry.requireCapability('META', 'PUBLISH')).toBe(metaPlugin)
    expect(registry.list()).toEqual([metaPlugin.manifest])
  })

  it('rejects duplicate provider registration', () => {
    const registry = new AdsProviderRegistry()
    registry.register(metaPlugin)
    expect(() => registry.register(metaPlugin)).toThrow('already registered')
  })
})
