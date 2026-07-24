/**
 * Normalize Unlighthouse / mock CLI output → compact payload for AI-SEO (plan §6).
 */

export type NormalizedLabMetric = {
  numericValue: number | null
  displayValue: string | null
}

export type NormalizedLabIssue = {
  category: 'performance' | 'accessibility' | 'best-practices' | 'seo'
  auditKey: string
  title: string
  description: string
  score: number | null
  severity: 'critical' | 'warning' | 'info'
  impactMs: number | null
  impactBytes: number | null
  items: string[]
}

export type NormalizedLabPage = {
  url: string
  finalUrl: string
  device: 'mobile' | 'desktop'
  scores: {
    performance: number | null
    accessibility: number | null
    'best-practices': number | null
    seo: number | null
  }
  metrics: {
    largestContentfulPaint: NormalizedLabMetric
    cumulativeLayoutShift: NormalizedLabMetric
    totalBlockingTime: NormalizedLabMetric
    firstContentfulPaint: NormalizedLabMetric
    speedIndex: NormalizedLabMetric
    serverResponseTime: NormalizedLabMetric
  }
  issues: NormalizedLabIssue[]
}

export type NormalizedLabResult = {
  version: 1
  source: 'unlighthouse'
  mock: boolean
  lighthouseVersion: string | null
  fetchedAt: string
  pages: NormalizedLabPage[]
  aggregate: {
    pagesScanned: number
    pagesFailed: number
    avgPerformance: number | null
    worstPages: Array<{ url: string; performance: number | null; lcpMs: number | null }>
  }
}

function toPercent(score: unknown): number | null {
  if (score == null || Number.isNaN(Number(score))) return null
  const n = Number(score)
  // Unlighthouse often 0–1; some reporters already 0–100
  if (n >= 0 && n <= 1) return Math.round(n * 100)
  if (n > 1 && n <= 100) return Math.round(n)
  return null
}

function metricFromUnknown(raw: unknown): NormalizedLabMetric {
  if (typeof raw === 'number') {
    return { numericValue: raw, displayValue: null }
  }
  if (!raw || typeof raw !== 'object') {
    return { numericValue: null, displayValue: null }
  }
  const o = raw as Record<string, unknown>
  const numeric =
    typeof o.numericValue === 'number'
      ? o.numericValue
      : typeof o === 'number'
        ? o
        : null
  return {
    numericValue: numeric,
    displayValue: typeof o.displayValue === 'string' ? o.displayValue : null,
  }
}

function objectFromUnknown(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

function nestedObject(
  raw: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  return objectFromUnknown(raw?.[key])
}

function firstObject(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    const object = objectFromUnknown(value)
    if (object) return object
  }
  return null
}

function scoreFromCategory(
  categories: Record<string, unknown> | null,
  key: string,
): number | null {
  const category = objectFromUnknown(categories?.[key])
  return toPercent(category?.score)
}

function rowsFromRaw(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  const object = objectFromUnknown(raw)
  if (!object) return []

  for (const key of ['pages', 'routes', 'results', 'reports']) {
    const rows = object[key]
    if (Array.isArray(rows)) return rows
    const rowMap = objectFromUnknown(rows)
    if (rowMap) return Object.values(rowMap)
  }

  return [object]
}

function resolveReport(row: Record<string, unknown>): Record<string, unknown> | null {
  if (objectFromUnknown(row.categories)) {
    return row
  }
  return firstObject(
    row.report,
    row.lhr,
    row.lighthouse,
    row.lighthouseResult,
    row.result,
    nestedObject(row, 'data')?.report,
    nestedObject(row, 'data')?.lhr,
  )
}

function resolveAudit(
  row: Record<string, unknown>,
  report: Record<string, unknown> | null,
  auditKey: string,
  camelKey: string,
): unknown {
  const audits = nestedObject(report, 'audits')
  const metrics = nestedObject(row, 'metrics')
  return (
    audits?.[auditKey] ??
    audits?.[camelKey] ??
    metrics?.[camelKey] ??
    metrics?.[auditKey] ??
    row[camelKey] ??
    row[auditKey]
  )
}

function severityFromScore(score: number | null): 'critical' | 'warning' | 'info' {
  if (score == null) return 'info'
  if (score < 50) return 'critical'
  if (score < 90) return 'warning'
  return 'info'
}

/**
 * Accepts:
 * - jsonExpanded-like array of page objects
 * - single page object
 * - mock factory input
 */
export function normalizeUnlighthouseOutput(input: {
  raw: unknown
  targetUrl: string
  device: 'mobile' | 'desktop'
  mock?: boolean
  lighthouseVersion?: string | null
}): NormalizedLabResult {
  const fetchedAt = new Date().toISOString()
  const rows = rowsFromRaw(input.raw)

  const pages: NormalizedLabPage[] = []

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const report = resolveReport(r)
    const categories = nestedObject(report, 'categories')
    const pathOrUrl = String(
      r.path ??
        r.route ??
        r.url ??
        r.finalUrl ??
        report?.finalUrl ??
        report?.finalDisplayedUrl ??
        report?.requestedUrl ??
        input.targetUrl,
    )
    let absolute = pathOrUrl
    try {
      absolute = new URL(pathOrUrl, input.targetUrl).toString()
    } catch {
      absolute = input.targetUrl
    }

    const scores = {
      performance:
        toPercent(r.performance) ??
        scoreFromCategory(categories, 'performance') ??
        toPercent(r.score),
      accessibility:
        toPercent(r.accessibility) ??
        scoreFromCategory(categories, 'accessibility'),
      'best-practices':
        toPercent(r['best-practices'] ?? r.bestPractices) ??
        scoreFromCategory(categories, 'best-practices'),
      seo:
        toPercent(r.seo) ??
        scoreFromCategory(categories, 'seo'),
    }

    const metricsRaw = (r.metrics as Record<string, unknown> | undefined) ?? r
    const metrics = {
      largestContentfulPaint: metricFromUnknown(
        resolveAudit(r, report, 'largest-contentful-paint', 'largestContentfulPaint') ??
          metricsRaw.lcp ??
          r.LargestContentfulPaint,
      ),
      cumulativeLayoutShift: metricFromUnknown(
        resolveAudit(r, report, 'cumulative-layout-shift', 'cumulativeLayoutShift') ??
          metricsRaw.cls,
      ),
      totalBlockingTime: metricFromUnknown(
        resolveAudit(r, report, 'total-blocking-time', 'totalBlockingTime') ??
          metricsRaw.tbt,
      ),
      firstContentfulPaint: metricFromUnknown(
        resolveAudit(r, report, 'first-contentful-paint', 'firstContentfulPaint') ??
          metricsRaw.fcp,
      ),
      speedIndex: metricFromUnknown(
        resolveAudit(r, report, 'speed-index', 'speedIndex'),
      ),
      serverResponseTime: metricFromUnknown(
        resolveAudit(r, report, 'server-response-time', 'serverResponseTime') ??
          resolveAudit(r, report, 'time-to-first-byte', 'serverResponseTime') ??
          metricsRaw.ttfb,
      ),
    }

    // Prefer numeric LCP from flat csvExpanded style
    if (metrics.largestContentfulPaint.numericValue == null && typeof r.lcp === 'number') {
      metrics.largestContentfulPaint = { numericValue: r.lcp, displayValue: null }
    }
    if (metrics.cumulativeLayoutShift.numericValue == null && typeof r.cls === 'number') {
      metrics.cumulativeLayoutShift = { numericValue: r.cls, displayValue: null }
    }

    const issues: NormalizedLabIssue[] = []
    const rawIssues = Array.isArray(r.issues) ? r.issues : []
    for (const issue of rawIssues.slice(0, 15)) {
      if (!issue || typeof issue !== 'object') continue
      const i = issue as Record<string, unknown>
      const score = toPercent(i.score)
      issues.push({
        category: (['performance', 'accessibility', 'best-practices', 'seo'].includes(
          String(i.category),
        )
          ? String(i.category)
          : 'performance') as NormalizedLabIssue['category'],
        auditKey: String(i.auditKey ?? i.id ?? 'unknown'),
        title: String(i.title ?? i.auditKey ?? 'Issue'),
        description: String(i.description ?? ''),
        score,
        severity:
          (i.severity as NormalizedLabIssue['severity']) ?? severityFromScore(score),
        impactMs: typeof i.impactMs === 'number' ? i.impactMs : null,
        impactBytes: typeof i.impactBytes === 'number' ? i.impactBytes : null,
        items: Array.isArray(i.items)
          ? i.items.map(String).slice(0, 10)
          : [],
      })
    }

    pages.push({
      url: absolute,
      finalUrl: String(
        r.finalUrl ??
          report?.finalUrl ??
          report?.finalDisplayedUrl ??
          absolute,
      ),
      device: input.device,
      scores,
      metrics,
      issues,
    })
  }

  if (pages.length === 0) {
    pages.push({
      url: input.targetUrl,
      finalUrl: input.targetUrl,
      device: input.device,
      scores: {
        performance: null,
        accessibility: null,
        'best-practices': null,
        seo: null,
      },
      metrics: {
        largestContentfulPaint: { numericValue: null, displayValue: null },
        cumulativeLayoutShift: { numericValue: null, displayValue: null },
        totalBlockingTime: { numericValue: null, displayValue: null },
        firstContentfulPaint: { numericValue: null, displayValue: null },
        speedIndex: { numericValue: null, displayValue: null },
        serverResponseTime: { numericValue: null, displayValue: null },
      },
      issues: [],
    })
  }

  const perfValues = pages
    .map((p) => p.scores.performance)
    .filter((n): n is number => n != null)
  const avgPerformance =
    perfValues.length > 0
      ? Math.round(perfValues.reduce((a, b) => a + b, 0) / perfValues.length)
      : null

  const worstPages = [...pages]
    .sort((a, b) => (a.scores.performance ?? 101) - (b.scores.performance ?? 101))
    .slice(0, 5)
    .map((p) => ({
      url: p.url,
      performance: p.scores.performance,
      lcpMs: p.metrics.largestContentfulPaint.numericValue,
    }))

  return {
    version: 1,
    source: 'unlighthouse',
    mock: Boolean(input.mock),
    lighthouseVersion: input.lighthouseVersion ?? null,
    fetchedAt,
    pages,
    aggregate: {
      pagesScanned: pages.length,
      pagesFailed: pages.filter((p) => p.scores.performance == null).length,
      avgPerformance,
      worstPages,
    },
  }
}

/** Deterministic mock for tests / environments without Chromium. */
export function buildMockUnlighthouseRaw(targetUrl: string): Record<string, unknown> {
  let hash = 0
  for (let i = 0; i < targetUrl.length; i++) {
    hash = (hash * 31 + targetUrl.charCodeAt(i)) >>> 0
  }
  const perf = 55 + (hash % 40)
  const seo = 70 + (hash % 25)
  return {
    path: '/',
    url: targetUrl,
    finalUrl: targetUrl,
    performance: perf / 100,
    accessibility: 0.92,
    'best-practices': 0.88,
    seo: seo / 100,
    metrics: {
      largestContentfulPaint: { numericValue: 1800 + (hash % 2000), displayValue: null },
      cumulativeLayoutShift: { numericValue: (hash % 20) / 100, displayValue: null },
      totalBlockingTime: { numericValue: 100 + (hash % 400), displayValue: null },
      firstContentfulPaint: { numericValue: 900 + (hash % 800), displayValue: null },
      speedIndex: { numericValue: 2000 + (hash % 1500), displayValue: null },
      serverResponseTime: { numericValue: 200 + (hash % 300), displayValue: null },
    },
    issues: [
      {
        category: 'performance',
        auditKey: 'render-blocking-resources',
        title: 'Eliminate render-blocking resources',
        description: 'Mock issue for pre-publish lab scan',
        score: 0.4,
        impactMs: 320,
        items: ['/assets/app.css'],
      },
      {
        category: 'seo',
        auditKey: 'meta-description',
        title: 'Document does not have a meta description',
        description: 'Mock SEO issue',
        score: 0,
        items: [],
      },
    ],
  }
}
