/**
 * Pure HTML helpers for AI-SEO / Umami tracking inject (publish pipeline).
 * Idempotent: never duplicate the same snippet.
 */

export function injectHtmlBeforeHeadClose(html: string, snippet: string): string {
  if (!html || !snippet) return html
  if (html.includes(snippet)) return html
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${snippet}</head>`)
  }
  return `${html}\n${snippet}`
}

export function buildLioraSeoPixelScript(seoProjectId: string): string {
  return `<script data-liora-ai-seo-project="${seoProjectId}"></script>`
}

export function htmlHasSeoPixel(html: string, seoProjectId: string): boolean {
  return html.includes(`data-liora-ai-seo-project="${seoProjectId}"`)
}

export function htmlHasUmamiWebsite(html: string, websiteId: string): boolean {
  return html.includes(`data-website-id="${websiteId}"`)
}
