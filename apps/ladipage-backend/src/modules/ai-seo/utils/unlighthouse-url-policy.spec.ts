import { assertScanableUrl, isLocalHostname, phaseForTrigger } from './unlighthouse-url-policy'

describe('unlighthouse-url-policy', () => {
  it('accepts public https URLs', () => {
    const r = assertScanableUrl('https://shop.example.com/lp/1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.kind).toBe('public')
      expect(r.url).toContain('https://shop.example.com')
    }
  })

  it('rejects localhost without allowLocal', () => {
    const r = assertScanableUrl('http://localhost:3000/preview')
    expect(r.ok).toBe(false)
  })

  it('allows localhost when allowLocal', () => {
    const r = assertScanableUrl('http://localhost:3000/preview', { allowLocal: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.kind).toBe('local')
  })

  it('blocks metadata IP', () => {
    const r = assertScanableUrl('http://169.254.169.254/latest/meta-data', { allowLocal: true })
    expect(r.ok).toBe(false)
  })

  it('blocks file protocol', () => {
    const r = assertScanableUrl('file:///etc/passwd')
    expect(r.ok).toBe(false)
  })

  it('detects local hostnames', () => {
    expect(isLocalHostname('localhost')).toBe(true)
    expect(isLocalHostname('127.0.0.1')).toBe(true)
    expect(isLocalHostname('example.com')).toBe(false)
  })

  it('maps trigger to phase', () => {
    expect(phaseForTrigger('editor', 'local')).toBe('pre_publish')
    expect(phaseForTrigger('publish', 'public')).toBe('post_publish')
    expect(phaseForTrigger('ai_seo', 'public')).toBe('post_publish')
  })
})
