/**
 * Canonical Instatic ids for a LadiPage landing.
 * Both Nest and Instatic SSO/ensure/import must use the same pageKey.
 */
export function canonicalInstaticPageId(ladipagePageId: string): string {
  const id = ladipagePageId.trim()
  if (!id) return id
  return id.startsWith('page_') ? id : `page_${id}`
}

export function ladipagePageIdFromInstatic(externalPageId: string): string | null {
  const id = externalPageId.trim()
  if (!id.startsWith('page_')) return null
  const rest = id.slice('page_'.length).trim()
  return rest || null
}

export function buildPublicPageUrl(origin: string | undefined, slug: string | undefined): string | null {
  const base = (origin ?? '').trim().replace(/\/$/, '')
  const pathSlug = (slug ?? '').trim().replace(/^\//, '')
  if (!base || !pathSlug) return null
  return `${base}/p/${encodeURIComponent(pathSlug)}`
}

export function buildEditorSsoUrls(origin: string | undefined, token: string): {
  cmsPath: string
  editorUrl: string
} {
  const cmsPath = `/admin/api/cms/auth/ladipage-sso?token=${encodeURIComponent(token)}`
  const base = (origin ?? '').trim().replace(/\/$/, '')
  return {
    cmsPath,
    editorUrl: base ? `${base}${cmsPath}` : cmsPath,
  }
}
