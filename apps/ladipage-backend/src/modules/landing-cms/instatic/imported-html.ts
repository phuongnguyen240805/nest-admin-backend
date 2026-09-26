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
