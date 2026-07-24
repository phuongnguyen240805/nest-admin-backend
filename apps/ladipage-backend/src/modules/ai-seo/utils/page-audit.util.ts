/**
 * Path B-lite: lightweight HTML rules for on-page SEO issues → tasks.
 * No external deps — pure string/heuristics.
 */

export type PageAuditIssueType = 'ON_PAGE' | 'CONTENT' | 'TECHNICAL'

export type PageAuditIssue = {
  code: string
  severity: 'error' | 'warning' | 'info'
  type: PageAuditIssueType
  current: string | null
  suggested: string | null
  message: string
  /** Deployable meta fields when present */
  metaTitle?: string
  metaDescription?: string
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
    'i',
  )
  const m = html.match(re)
  return (m?.[1] ?? m?.[2] ?? '').trim() || null
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1]?.replace(/\s+/g, ' ').trim() || null
}

function countTags(html: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b`, 'gi')
  return (html.match(re) ?? []).length
}

function textApproxLength(html: string): number {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length
}

function hasCanonical(html: string): boolean {
  return /rel=["']canonical["']/i.test(html)
}

function hasOgTitle(html: string): boolean {
  return /property=["']og:title["']/i.test(html)
}

/**
 * Audit raw HTML for common on-page SEO issues.
 */
export function auditHtml(html: string, pageUrl: string): PageAuditIssue[] {
  const issues: PageAuditIssue[] = []
  if (!html?.trim()) {
    issues.push({
      code: 'empty_html',
      severity: 'error',
      type: 'TECHNICAL',
      current: null,
      suggested: null,
      message: `No HTML returned from ${pageUrl}`,
    })
    return issues
  }

  const title = titleTag(html)
  if (!title) {
    issues.push({
      code: 'missing_title',
      severity: 'error',
      type: 'ON_PAGE',
      current: null,
      suggested: 'Add a descriptive title (30–60 characters)',
      message: 'Missing <title> tag',
      metaTitle: 'Add a descriptive page title (30–60 characters)',
    })
  } else if (title.length < 30) {
    issues.push({
      code: 'title_too_short',
      severity: 'warning',
      type: 'ON_PAGE',
      current: title,
      suggested: `${title} | expand to 30–60 characters`,
      message: `Title is short (${title.length} chars); aim 30–60`,
      metaTitle: title.length < 50 ? `${title} — complete your offer` : title,
    })
  } else if (title.length > 60) {
    issues.push({
      code: 'title_too_long',
      severity: 'warning',
      type: 'ON_PAGE',
      current: title,
      suggested: title.slice(0, 57).trimEnd() + '…',
      message: `Title is long (${title.length} chars); aim ≤60`,
      metaTitle: title.slice(0, 60).trim(),
    })
  }

  const description = metaContent(html, 'description')
  if (!description) {
    issues.push({
      code: 'missing_meta_description',
      severity: 'error',
      type: 'ON_PAGE',
      current: null,
      suggested: 'Write a meta description (70–160 characters)',
      message: 'Missing meta description',
      metaDescription: 'Summarize the page value proposition in 70–160 characters.',
    })
  } else if (description.length < 70) {
    issues.push({
      code: 'meta_description_short',
      severity: 'warning',
      type: 'ON_PAGE',
      current: description,
      suggested: description,
      message: `Meta description short (${description.length} chars); aim 70–160`,
      metaDescription: description,
    })
  } else if (description.length > 160) {
    issues.push({
      code: 'meta_description_long',
      severity: 'warning',
      type: 'ON_PAGE',
      current: description,
      suggested: description.slice(0, 157).trimEnd() + '…',
      message: `Meta description long (${description.length} chars); aim ≤160`,
      metaDescription: description.slice(0, 160).trim(),
    })
  }

  const h1Count = countTags(html, 'h1')
  if (h1Count === 0) {
    issues.push({
      code: 'missing_h1',
      severity: 'error',
      type: 'CONTENT',
      current: null,
      suggested: 'Add a single clear H1 matching primary intent',
      message: 'Missing H1 heading',
    })
  } else if (h1Count > 1) {
    issues.push({
      code: 'multiple_h1',
      severity: 'warning',
      type: 'CONTENT',
      current: String(h1Count),
      suggested: '1',
      message: `Found ${h1Count} H1 tags; prefer a single H1`,
    })
  }

  const bodyLen = textApproxLength(html)
  if (bodyLen > 0 && bodyLen < 300) {
    issues.push({
      code: 'thin_content',
      severity: 'warning',
      type: 'CONTENT',
      current: String(bodyLen),
      suggested: null,
      message: `Thin text content (~${bodyLen} chars); expand primary copy`,
    })
  }

  if (!hasCanonical(html)) {
    issues.push({
      code: 'missing_canonical',
      severity: 'info',
      type: 'TECHNICAL',
      current: null,
      suggested: pageUrl,
      message: 'Missing rel=canonical',
    })
  }

  if (!hasOgTitle(html)) {
    issues.push({
      code: 'missing_og_title',
      severity: 'info',
      type: 'ON_PAGE',
      current: null,
      suggested: title,
      message: 'Missing og:title for social sharing',
    })
  }

  return issues
}

/** 0–100 scores from page issues (higher = healthier). */
export function scoresFromPageIssues(issues: PageAuditIssue[]): {
  technicalsScore: number
  contentScore: number
  uxScore: number
  authorityScore: number
} {
  const penalize = (type: PageAuditIssueType, weight: number) => {
    const typed = issues.filter((i) => i.type === type)
    let pen = 0
    for (const i of typed) {
      if (i.severity === 'error') pen += 18 * weight
      else if (i.severity === 'warning') pen += 10 * weight
      else pen += 4 * weight
    }
    return pen
  }

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
  return {
    technicalsScore: clamp(88 - penalize('TECHNICAL', 1) - penalize('ON_PAGE', 0.35)),
    contentScore: clamp(85 - penalize('CONTENT', 1) - penalize('ON_PAGE', 0.25)),
    uxScore: clamp(75 - penalize('CONTENT', 0.3)),
    // Authority not derived from HTML — leave mid baseline for merge
    authorityScore: 50,
  }
}
