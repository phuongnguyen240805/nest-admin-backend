/**
 * Stable Ladipage-owned port for Instatic-backed landing authoring.
 * Domain code must depend only on this interface — not raw Instatic HTTP.
 */

export type LandingEngine = 'legacy' | 'instatic'

export interface PageRef {
  ladipageId: string
  engine: LandingEngine
  externalSiteId: string | null
  externalPageId: string | null
  slug: string
  name: string
}

export interface EditorSessionResult {
  pageId: string
  /** Same-origin path: /landing-pages/:id/edit */
  editPath: string
  /** Path under CMS proxy / SSO: /_cms/admin/api/cms/auth/ladipage-sso?token= */
  cmsPath: string
  /**
   * Preferred browser URL for Phase-2 SSO (full navigation).
   * Hits Instatic, sets session cookie, redirects to /admin/site.
   */
  editorUrl: string
  /** Opaque SSO ticket (also embedded in editorUrl). */
  sessionToken: string
  expiresAt: string
  engine: LandingEngine
}

export interface MaterializeHtmlInput {
  pageId: string
  html: string
  name?: string
  slug?: string
  workspaceId?: string
  actorUserId: number
}

export interface MaterializeHtmlResult {
  pageId: string
  externalSiteId: string
  externalPageId: string
  engine: 'instatic'
}

export interface PublishedArtifact {
  pageId: string
  html: string
  meta: {
    title: string
    description?: string
    ogImage?: string
  }
  etag: string
  source: 'instatic' | 'mock'
}

export interface PublishIntentInput {
  pageId: string
  externalPageId?: string
  html?: string
  etag?: string
  seoTitle?: string
  seoDescription?: string
}

export interface PublishIntentResult {
  accepted: boolean
  pageId: string
  artifact: PublishedArtifact
}

export const LANDING_PAGE_PORT = Symbol('LANDING_PAGE_PORT')

export interface LandingPagePort {
  openEditorSession(pageId: string, actorUserId: number): Promise<EditorSessionResult>
  materializeFromHtml(input: MaterializeHtmlInput): Promise<MaterializeHtmlResult>
  getPublishedArtifact(pageId: string): Promise<PublishedArtifact>
  acceptPublishIntent(input: PublishIntentInput): Promise<PublishIntentResult>
  runtimeHealth(): Promise<{ ok: boolean; mock: boolean; protocol: string; baseUrl: string }>
}
