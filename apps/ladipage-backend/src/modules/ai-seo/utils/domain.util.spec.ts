import {
  extractHostname,
  isPublicRegistrableDomain,
  publicDomainErrorMessage,
  resolveSeoHostname,
} from './domain.util'

describe('domain.util', () => {
  it('extractHostname strips protocol path www', () => {
    expect(extractHostname('https://www.Example.com/p/x')).toBe('example.com')
    expect(extractHostname('example.com')).toBe('example.com')
  })

  it('isPublicRegistrableDomain accepts real hosts', () => {
    expect(isPublicRegistrableDomain('example.com')).toBe(true)
    expect(isPublicRegistrableDomain('https://shop.example.com/path')).toBe(true)
  })

  it('isPublicRegistrableDomain rejects local / bare / uuid', () => {
    expect(isPublicRegistrableDomain('localhost')).toBe(false)
    expect(isPublicRegistrableDomain('127.0.0.1')).toBe(false)
    expect(isPublicRegistrableDomain('my-page.local')).toBe(false)
    expect(isPublicRegistrableDomain('myslug')).toBe(false)
    expect(isPublicRegistrableDomain('834192fe-dfd2-4f79-9b54-a4c43fce5ad3')).toBe(false)
    expect(isPublicRegistrableDomain('')).toBe(false)
  })

  it('resolveSeoHostname prefers public domain over local', () => {
    expect(
      resolveSeoHostname(['http://localhost:3000/p/x', 'https://shop.example.com']),
    ).toBe('shop.example.com')
  })

  it('publicDomainErrorMessage mentions example.com', () => {
    expect(publicDomainErrorMessage('localhost')).toMatch(/example\.com/)
    expect(publicDomainErrorMessage('localhost')).toMatch(/localhost/)
  })
})
