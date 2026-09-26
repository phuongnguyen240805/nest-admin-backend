const ABSOLUTE_OR_SPECIAL = /^(?:https?:|data:|blob:|\/\/|#|mailto:|tel:)/i

const RESTAURANT_HINT =
  /assets\/img\/(?:plate\d+|home|about|app\d+|movil-app)\.(?:png|jpe?g|webp)/i

export function extractLandingHtml(input: {
  aiSourceHtml?: string | null
  publishedHtml?: string | null
  editorData?: unknown
}): string | null {
  const published = trimHtml(input.publishedHtml)
  const fromEditor = extractEditorHtml(input.editorData)
  const aiSource = trimHtml(input.aiSourceHtml)
  return published || fromEditor || aiSource
}

const STYLESHEET_HREF_RE =
  /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi

const MAX_STYLESHEETS = 8
const MAX_STYLESHEET_BYTES = 500_000

export async function collectLinkedStylesheets(
  html: string,
  publicOrigin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const origin = normalizeOrigin(publicOrigin)
  const chunks: string[] = []
  const inlineCss = extractInlineStyleCss(html, origin)
  if (inlineCss) chunks.push(inlineCss)

  const hrefs: string[] = []
  STYLESHEET_HREF_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = STYLESHEET_HREF_RE.exec(html)) !== null) {
    const href = (match[1] || match[2] || '').trim()
    if (href) hrefs.push(href)
  }

  for (const href of hrefs.slice(0, MAX_STYLESHEETS)) {
    if (!isAllowedStylesheetUrl(href, origin)) continue
    try {
      const res = await fetchImpl(href, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) continue
      const css = await res.text()
      if (!css.trim() || css.length > MAX_STYLESHEET_BYTES) continue
      chunks.push(`/* ${href} */\n${rewriteCssAssetUrls(css, href)}`)
    } catch {
      /* skip unreachable stylesheets — layout may degrade */
    }
  }
  return chunks.join('\n\n')
}

const STYLE_TAG_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi

function extractInlineStyleCss(html: string, origin: string | null): string {
  const base = origin ? inferRelativeAssetBase(html, origin) : ''
  const chunks: string[] = []
  STYLE_TAG_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = STYLE_TAG_RE.exec(html)) !== null) {
    const css = match[1]?.trim() ?? ''
    if (!css || css.length > MAX_STYLESHEET_BYTES) continue
    chunks.push(origin ? rewriteCssAssetUrls(css, base.endsWith('/') ? base : `${base}/`) : css)
  }
  return chunks.join('\n\n')
}

function isAllowedStylesheetUrl(href: string, publicOrigin: string | null): boolean {
  try {
    const url = new URL(href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (publicOrigin && host === new URL(publicOrigin).hostname) return true
    return host === 'cdn.jsdelivr.net' || host.endsWith('.jsdelivr.net')
  } catch {
    return false
  }
}

function rewriteCssAssetUrls(css: string, cssFileUrl: string): string {
  return css.replace(
    /url\(\s*(['"]?)([^)"']+)\1\s*\)/gi,
    (full, quote: string, raw: string) => {
      const src = raw.trim()
      if (!src || ABSOLUTE_OR_SPECIAL.test(src)) return full
      try {
        return `url(${quote}${new URL(src, cssFileUrl).href}${quote})`
      } catch {
        return full
      }
    },
  )
}

export function rewriteImportedLandingHtml(html: string, publicOrigin: string): string {
  const origin = normalizeOrigin(publicOrigin)
  if (!origin || !html.trim()) return html
  const relativeBase = inferRelativeAssetBase(html, origin)

  return html
    .replace(
      /(\s(?:src|href|poster)=["'])([^"']+)(["'])/gi,
      (_m, pre: string, url: string, post: string) =>
        `${pre}${rewriteAssetUrl(url, origin, relativeBase)}${post}`,
    )
    .replace(
      /url\(\s*(['"]?)([^)"']+)\1\s*\)/gi,
      (_m, quote: string, url: string) =>
        `url(${quote}${rewriteAssetUrl(url, origin, relativeBase)}${quote})`,
    )
}

export function rewriteAssetUrl(raw: string, origin: string, relativeBase: string): string {
  const src = raw.trim()
  if (!src || ABSOLUTE_OR_SPECIAL.test(src)) return src
  if (src.startsWith('/')) return `${origin}${src}`
  try {
    return new URL(src, relativeBase.endsWith('/') ? relativeBase : `${relativeBase}/`).href
  } catch {
    return src
  }
}

function inferRelativeAssetBase(html: string, origin: string): string {
  const fromHtml = html.match(/\/templates\/[A-Za-z0-9._\-]+(?:\/[A-Za-z0-9._\-]+)+\//)
  if (fromHtml) return `${origin}${fromHtml[0]}`
  if (RESTAURANT_HINT.test(html) || /class=["']menu__img["']/.test(html)) {
    return `${origin}/templates/bedimcode/responsive-website-restaurant/`
  }
  return `${origin}/`
}

function trimHtml(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function extractEditorHtml(editorData: unknown): string | null {
  if (typeof editorData === 'string') return trimHtml(editorData)
  if (!editorData || typeof editorData !== 'object' || Array.isArray(editorData)) {
    return null
  }
  const data = editorData as Record<string, unknown>
  for (const key of ['html', 'publishedHtml', 'sourceHtml', 'gjs-html']) {
    const found = trimHtml(data[key])
    if (found) return found
  }
  if (Array.isArray(data.sections)) {
    for (const section of data.sections) {
      const found = extractHtmlCodeBlock(section)
      if (found) return found
    }
  }
  return null
}

function extractHtmlCodeBlock(block: unknown): string | null {
  if (!block || typeof block !== 'object') return null
  const row = block as Record<string, unknown>
  const props = row.props && typeof row.props === 'object'
    ? (row.props as Record<string, unknown>)
    : null
  if (
    (row.type === 'html_code' || props?.preserveHtml === true) &&
    typeof props?.code === 'string'
  ) {
    const found = trimHtml(props.code)
    if (found) return found
  }
  if (Array.isArray(row.children)) {
    for (const child of row.children) {
      const found = extractHtmlCodeBlock(child)
      if (found) return found
    }
  }
  return null
}

function normalizeOrigin(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    return url.origin
  } catch {
    return null
  }
}
