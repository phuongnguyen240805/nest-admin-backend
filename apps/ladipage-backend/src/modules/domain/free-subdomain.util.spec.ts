import {
  buildFreeSubdomainUrl,
  isValidFreeSubdomainSlug,
  normalizeFreeSubdomainSlug,
  pickPublicUrl,
} from './free-subdomain.util'

describe('free-subdomain.util', () => {
  it('normalizes slugs', () => {
    expect(normalizeFreeSubdomainSlug('Cafe Ha Noi!')).toBe('cafe-ha-noi')
  })

  it('rejects reserved slugs', () => {
    expect(isValidFreeSubdomainSlug('www')).toBe(false)
    expect(isValidFreeSubdomainSlug('app')).toBe(false)
    expect(isValidFreeSubdomainSlug('cafe-ha-noi')).toBe(true)
  })

  it('builds free subdomain URL when enabled', () => {
    expect(
      buildFreeSubdomainUrl('cafe-ha-noi', {
        enabled: true,
        baseDomain: 'liora.app',
      }),
    ).toBe('https://cafe-ha-noi.liora.app')
  })

  it('returns null when disabled or reserved', () => {
    expect(
      buildFreeSubdomainUrl('cafe', { enabled: false, baseDomain: 'liora.app' }),
    ).toBeNull()
    expect(
      buildFreeSubdomainUrl('www', { enabled: true, baseDomain: 'liora.app' }),
    ).toBeNull()
  })

  it('picks public URL priority custom > subdomain > platform', () => {
    expect(
      pickPublicUrl({
        customPublicUrl: 'https://shop.vn',
        subdomainUrl: 'https://a.liora.app',
        platformUrl: 'https://app/p/a',
      }),
    ).toBe('https://shop.vn')
    expect(
      pickPublicUrl({
        customPublicUrl: null,
        subdomainUrl: 'https://a.liora.app',
        platformUrl: 'https://app/p/a',
      }),
    ).toBe('https://a.liora.app')
  })
})
