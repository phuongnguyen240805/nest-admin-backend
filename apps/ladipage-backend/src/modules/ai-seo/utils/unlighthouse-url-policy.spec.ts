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

  it.each([
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://[::1]',
    'http://[fd00::1]',
    'http://metadata.google.internal',
    'http://user:pass@example.com',
    'http://2130706433',
  ])('blocks unsafe target %s', (url) => {
    expect(assertScanableUrl(url, { allowLocal: false }).ok).toBe(false)
  })

  it('allows normal public https targets', () => {
    expect(assertScanableUrl('https://example.com/path').ok).toBe(true)
  })

  it('allows operator-controlled local development ports only in local mode', () => {
    expect(assertScanableUrl('http://localhost:3000', { allowLocal: false }).ok).toBe(false)
    expect(assertScanableUrl('http://localhost:3000', { allowLocal: true }).ok).toBe(true)
    expect(assertScanableUrl('http://localhost:3100', { allowLocal: true }).ok).toBe(true)
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
