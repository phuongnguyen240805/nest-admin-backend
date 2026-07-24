import { auditHtml, scoresFromPageIssues } from './page-audit.util'
import { resolveScanStartUrl, scanBlockedMessage } from './scan-url.util'

describe('page-audit.util', () => {
  it('flags missing title and description', () => {
    const issues = auditHtml('<html><body><h1>Hi</h1></body></html>', 'https://ex.com/p')
    expect(issues.some((i) => i.code === 'missing_title')).toBe(true)
    expect(issues.some((i) => i.code === 'missing_meta_description')).toBe(true)
  })

  it('accepts healthy meta', () => {
    const html = `
      <html><head>
        <title>Best Landing Page Offer For Q3 Sales</title>
        <meta name="description" content="A complete offer description that is long enough for search snippets and conversion." />
        <link rel="canonical" href="https://ex.com/p" />
        <meta property="og:title" content="Best Landing Page Offer For Q3 Sales" />
      </head>
      <body><h1>Offer</h1>${'word '.repeat(80)}</body></html>`
    const issues = auditHtml(html, 'https://ex.com/p')
    expect(issues.find((i) => i.code === 'missing_title')).toBeUndefined()
    expect(issues.find((i) => i.code === 'missing_meta_description')).toBeUndefined()
    expect(issues.find((i) => i.code === 'missing_h1')).toBeUndefined()
  })

  it('scores drop when many errors', () => {
    const bad = scoresFromPageIssues(
      auditHtml('<html><body></body></html>', 'https://ex.com'),
    )
    const good = scoresFromPageIssues(
      auditHtml(
        `<html><head><title>Solid Product Landing Title Here Now</title>
         <meta name="description" content="Detailed description of the product benefits for customers searching online today."/>
         <link rel="canonical" href="https://ex.com"/></head>
         <body><h1>Product</h1>${'content '.repeat(100)}</body></html>`,
        'https://ex.com',
      ),
    )
    expect(good.contentScore).toBeGreaterThan(bad.contentScore)
    expect(good.technicalsScore).toBeGreaterThanOrEqual(bad.technicalsScore)
  })
})

describe('scan-url.util', () => {
  it('prefers absolute public URL over localhost', () => {
    const r = resolveScanStartUrl([
      null,
      'http://localhost:3000/p/x',
      'https://shop.example.com/landing',
    ])
    expect(r.startUrl).toContain('shop.example.com')
    expect(r.canPageAudit).toBe(true)
    expect(r.canDomainOverview).toBe(true)
  })

  it('detects public domain overview capability', () => {
    const r = resolveScanStartUrl(['https://www.example.com/p/demo'])
    expect(r.canDomainOverview).toBe(true)
    expect(r.host).toBe('example.com')
  })

  it('blocks empty candidates', () => {
    const r = resolveScanStartUrl([null, '', undefined])
    expect(r.startUrl).toBeNull()
    expect(scanBlockedMessage(r.host)).toContain('Cannot start SEO scan')
  })
})
