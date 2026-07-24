import {
  getWslWindowsHostIp,
  normalizeMedusaBaseUrl,
  resolveMedusaBaseUrlCandidates,
} from './medusa-http.client'

describe('medusa base url helpers', () => {
  it('normalize strips trailing slash', () => {
    expect(normalizeMedusaBaseUrl('http://127.0.0.1:9000/')).toBe(
      'http://127.0.0.1:9000',
    )
  })

  it('candidates include localhost variants', () => {
    const list = resolveMedusaBaseUrlCandidates('http://localhost:9000')
    expect(list.some((u) => u.includes('127.0.0.1'))).toBe(true)
    expect(list.some((u) => u.includes('localhost'))).toBe(true)
  })

  it('getWslWindowsHostIp does not throw', () => {
    expect(() => getWslWindowsHostIp()).not.toThrow()
  })
})
