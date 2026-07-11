import { Inject, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

import { ILandingCmsConfig, LandingCmsConfig } from '../landing-cms.config'
import { createSessionToken, verifySessionToken } from './instatic-hmac'

export interface MintEditorSessionInput {
  pageId: string
  actorUserId: number
  externalSiteId: string
  externalPageId: string
  workspaceId?: string
}

export interface MintedEditorSession {
  sessionToken: string
  expiresAt: string
  /** Same-origin rewrite path (legacy / optional). */
  cmsPath: string
  /**
   * Full browser URL for Phase-2 SSO (preferred).
   * Hits Instatic GET /admin/api/cms/auth/ladipage-sso?token=...
   * then redirects to /admin/site with session cookie set.
   */
  editorUrl: string
}

const SSO_PURPOSE = 'ladipage-sso'
/** Short TTL for one-shot SSO tickets (seconds). */
const SSO_TTL_SECONDS = 120

@Injectable()
export class InstaticSsoService {
  constructor(
    @Inject(LandingCmsConfig.KEY)
    private readonly config: ILandingCmsConfig,
  ) {}

  mint(input: MintEditorSessionInput): MintedEditorSession {
    const exp = Math.floor(Date.now() / 1000) + SSO_TTL_SECONDS
    const jti = randomBytes(12).toString('hex')
    const sessionToken = createSessionToken(this.config.ssoSecret, {
      sub: String(input.actorUserId),
      pageId: input.pageId,
      siteId: input.externalSiteId,
      instaticPageId: input.externalPageId,
      workspaceId: input.workspaceId ?? null,
      exp,
      jti,
      purpose: SSO_PURPOSE,
    })

    // Relative same-origin path: browser stays on Ladipage host:port (Next rewrites /admin → Instatic)
    const ssoPath =
      `/admin/api/cms/auth/ladipage-sso?token=${encodeURIComponent(sessionToken)}`

    const cmsPath = ssoPath
    // Always relative: FE stays on Ladipage host:port (Next rewrites /admin → Instatic)
    const editorUrl = ssoPath

    return {
      sessionToken,
      expiresAt: new Date(exp * 1000).toISOString(),
      cmsPath,
      editorUrl,
    }
  }

  verify(token: string) {
    return verifySessionToken(this.config.ssoSecret, token)
  }
}
