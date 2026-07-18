import {
  buildEdgeKvKey,
  getCustomDomainCnameTarget,
  isValidCustomerHostname,
  mapCloudflareHostnameToDomainStatus,
  mapCloudflareSslToStatus,
  normalizeCustomerHostname,
} from './cloudflare-saas.util'

describe('cloudflare-saas.util (Plan B)', () => {
  it('normalizes and validates hostnames', () => {
    expect(normalizeCustomerHostname('https://WWW.Shop.VN/x')).toBe('www.shop.vn')
    expect(isValidCustomerHostname('www.shop.vn')).toBe(true)
    expect(isValidCustomerHostname('shop')).toBe(false)
  })

  it('builds KV keys', () => {
    expect(buildEdgeKvKey('www.shop.vn', '/')).toBe('www.shop.vn/')
    expect(buildEdgeKvKey('www.shop.vn', '/km')).toBe('www.shop.vn/km')
  })

  it('maps CF statuses', () => {
    expect(mapCloudflareSslToStatus('active')).toBe('ACTIVE')
    expect(
      mapCloudflareHostnameToDomainStatus({
        hostnameStatus: 'active',
        sslStatus: 'active',
      }),
    ).toBe('VERIFIED')
  })

  it('reads cname target from env with default', () => {
    expect(getCustomDomainCnameTarget({})).toBe('fallback.liora.app')
    expect(
      getCustomDomainCnameTarget({
        CUSTOM_DOMAIN_CNAME_TARGET: 'fallback.example.com',
      }),
    ).toBe('fallback.example.com')
  })

  it('accepts publicvm free-domain style hostnames', () => {
    expect(isValidCustomerHostname('ladipage.publicvm.com')).toBe(true)
    expect(isValidCustomerHostname('shop.ladipage.publicvm.com')).toBe(true)
    expect(normalizeCustomerHostname('https://Shop.Ladipage.Publicvm.com/')).toBe(
      'shop.ladipage.publicvm.com',
    )
    expect(buildEdgeKvKey('shop.ladipage.publicvm.com', '/')).toBe(
      'shop.ladipage.publicvm.com/',
    )
  })
})
