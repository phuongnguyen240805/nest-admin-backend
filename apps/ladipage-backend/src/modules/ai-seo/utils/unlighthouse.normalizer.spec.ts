import {
  buildMockUnlighthouseRaw,
  normalizeUnlighthouseOutput,
} from './unlighthouse.normalizer'

describe('unlighthouse.normalizer', () => {
  it('normalizes 0–1 scores to 0–100', () => {
    const result = normalizeUnlighthouseOutput({
      raw: {
        path: '/',
        performance: 0.72,
        accessibility: 1,
        'best-practices': 0.9,
        seo: 0.95,
        metrics: {
          largestContentfulPaint: { numericValue: 2400 },
          cumulativeLayoutShift: { numericValue: 0.05 },
        },
      },
      targetUrl: 'https://example.com/',
      device: 'mobile',
      mock: false,
    })

    expect(result.source).toBe('unlighthouse')
    expect(result.pages[0].scores.performance).toBe(72)
    expect(result.pages[0].scores.accessibility).toBe(100)
    expect(result.pages[0].metrics.largestContentfulPaint.numericValue).toBe(2400)
    expect(result.aggregate.avgPerformance).toBe(72)
  })

  it('builds deterministic mock raw', () => {
    const a = buildMockUnlighthouseRaw('https://a.example.com')
    const b = buildMockUnlighthouseRaw('https://a.example.com')
    const c = buildMockUnlighthouseRaw('https://b.example.com')
    expect(a.performance).toBe(b.performance)
    expect(a.performance).not.toBe(c.performance)
  })

  it('normalizes jsonExpanded lighthouse report pages', () => {
    const result = normalizeUnlighthouseOutput({
      raw: {
        pages: [
          {
            path: '/p/ladipage1',
            report: {
              finalUrl: 'http://host.docker.internal:3000/p/ladipage1',
              categories: {
                performance: { score: 0.83 },
                accessibility: { score: 0.91 },
                'best-practices': { score: 0.88 },
                seo: { score: 0.97 },
              },
              audits: {
                'largest-contentful-paint': {
                  numericValue: 2150,
                  displayValue: '2.2 s',
                },
                'cumulative-layout-shift': {
                  numericValue: 0.03,
                },
                'total-blocking-time': {
                  numericValue: 120,
                },
                'first-contentful-paint': {
                  numericValue: 980,
                },
                'speed-index': {
                  numericValue: 1800,
                },
              },
            },
          },
        ],
      },
      targetUrl: 'http://localhost:3000/p/ladipage1',
      device: 'mobile',
    })

    expect(result.pages[0].scores.performance).toBe(83)
    expect(result.pages[0].scores.seo).toBe(97)
    expect(result.pages[0].metrics.largestContentfulPaint.numericValue).toBe(2150)
    expect(result.aggregate.avgPerformance).toBe(83)
  })

  it('normalizes Unlighthouse 0.18 ci-result jsonExpanded routes', () => {
    const result = normalizeUnlighthouseOutput({
      raw: {
        summary: {
          score: 0.81,
        },
        routes: [
          {
            path: '/p/ladipage1',
            score: 0.81,
            categories: {
              performance: { score: 0.74 },
              accessibility: { score: 0.9 },
              'best-practices': { score: 0.86 },
              seo: { score: 0.96 },
            },
            metrics: {
              'largest-contentful-paint': {
                numericValue: 2380,
                displayValue: '2.4 s',
              },
              'cumulative-layout-shift': {
                numericValue: 0.04,
              },
              'total-blocking-time': {
                numericValue: 80,
              },
              'first-contentful-paint': {
                numericValue: 1020,
              },
            },
          },
        ],
      },
      targetUrl: 'http://localhost:3000/p/ladipage1',
      device: 'mobile',
    })

    expect(result.pages[0].scores.performance).toBe(74)
    expect(result.pages[0].scores.accessibility).toBe(90)
    expect(result.pages[0].scores['best-practices']).toBe(86)
    expect(result.pages[0].scores.seo).toBe(96)
    expect(result.pages[0].metrics.largestContentfulPaint.numericValue).toBe(2380)
    expect(result.pages[0].metrics.cumulativeLayoutShift.numericValue).toBe(0.04)
    expect(result.aggregate.pagesFailed).toBe(0)
  })

  it('normalizes raw lighthouse report json', () => {
    const result = normalizeUnlighthouseOutput({
      raw: {
        requestedUrl: 'http://localhost:3000/p/ladipage1',
        finalUrl: 'http://localhost:3000/p/ladipage1',
        categories: {
          performance: { score: 0.76 },
          accessibility: { score: 0.9 },
          'best-practices': { score: 0.86 },
          seo: { score: 0.94 },
        },
        audits: {
          'largest-contentful-paint': {
            numericValue: 2400,
            displayValue: '2.4 s',
          },
          'first-contentful-paint': {
            numericValue: 900,
          },
        },
      },
      targetUrl: 'http://localhost:3000/p/ladipage1',
      device: 'mobile',
    })

    expect(result.pages[0].scores.performance).toBe(76)
    expect(result.pages[0].scores.seo).toBe(94)
    expect(result.pages[0].metrics.largestContentfulPaint.numericValue).toBe(2400)
    expect(result.aggregate.pagesFailed).toBe(0)
  })

  it('caps issues and items', () => {
    const issues = Array.from({ length: 20 }, (_, i) => ({
      category: 'performance',
      auditKey: `k${i}`,
      title: `T${i}`,
      score: 0.2,
      items: Array.from({ length: 20 }, (__, j) => `item-${j}`),
    }))
    const result = normalizeUnlighthouseOutput({
      raw: { url: 'https://example.com', performance: 0.5, issues },
      targetUrl: 'https://example.com',
      device: 'mobile',
    })
    expect(result.pages[0].issues.length).toBeLessThanOrEqual(15)
    expect(result.pages[0].issues[0].items.length).toBeLessThanOrEqual(10)
  })
})
