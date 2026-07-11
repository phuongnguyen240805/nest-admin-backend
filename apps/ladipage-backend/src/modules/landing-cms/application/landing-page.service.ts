import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { createHash } from 'node:crypto'

import { ILandingCmsConfig, LandingCmsConfig } from '../landing-cms.config'
import { InstaticArtifactService } from '../instatic/instatic-artifact.service'
import { verifyBridgeSignature } from '../instatic/instatic-hmac'
import { InstaticImportService } from '../instatic/instatic-import.service'
import { InstaticSsoService } from '../instatic/instatic-sso.service'
import { InstaticClient } from '../instatic/instatic.client'
import type {
  EditorSessionResult,
  LandingPagePort,
  MaterializeHtmlInput,
  MaterializeHtmlResult,
  PublishIntentInput,
  PublishIntentResult,
  PublishedArtifact,
} from '../ports/landing-page.port'
import { PageRegistryStore } from './page-registry.store'

@Injectable()
export class LandingPageService implements LandingPagePort {
  constructor(
    @Inject(LandingCmsConfig.KEY)
    private readonly config: ILandingCmsConfig,
    private readonly registry: PageRegistryStore,
    private readonly sso: InstaticSsoService,
    private readonly importService: InstaticImportService,
    private readonly artifactService: InstaticArtifactService,
    private readonly client: InstaticClient,
  ) {}

  /**
   * Mint SSO ticket only — never call Instatic ensure-page (that route does not exist).
   * Mapping is provisional until workspace provision (GĐ2b).
   */
  async openEditorSession(pageId: string, actorUserId: number): Promise<EditorSessionResult> {
    if (!pageId?.trim()) {
      throw new BadRequestException('pageId is required')
    }

    const existing = await this.registry.get(pageId)
    const siteKey = `ws_${actorUserId}`
    const siteId = existing?.externalSiteId ?? `site_${siteKey}`
    const externalPageId = existing?.externalPageId ?? `page_${pageId}`

    // Best-effort registry write (columns may be missing until migration).
    await this.registry.upsert({
      pageId,
      name: existing?.name ?? pageId,
      slug: existing?.slug ?? pageId,
      engine: 'instatic',
      externalSiteId: siteId,
      externalPageId,
      ownerUserId: actorUserId,
    })

    const session = this.sso.mint({
      pageId,
      actorUserId,
      externalSiteId: siteId,
      externalPageId,
    })

    return {
      pageId,
      editPath: `/landing-pages/${encodeURIComponent(pageId)}/edit`,
      cmsPath: session.cmsPath,
      editorUrl: session.editorUrl,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      engine: 'instatic',
    }
  }

  async materializeFromHtml(input: MaterializeHtmlInput): Promise<MaterializeHtmlResult> {
    if (!input.html?.trim()) {
      throw new BadRequestException('html is required')
    }
    if (!input.pageId?.trim()) {
      throw new BadRequestException('pageId is required')
    }

    const workspaceKey = input.workspaceId?.trim() || `ws_${input.actorUserId}`
    const title = input.name?.trim() || input.pageId

    const mapped = await this.importService.materialize({
      pageId: input.pageId,
      workspaceKey,
      title,
      html: input.html,
    })

    await this.registry.upsert({
      pageId: input.pageId,
      name: title,
      slug: input.slug?.trim() || input.pageId,
      engine: 'instatic',
      externalSiteId: mapped.siteId,
      externalPageId: mapped.pageId,
      ownerUserId: input.actorUserId,
    })

    return {
      pageId: input.pageId,
      externalSiteId: mapped.siteId,
      externalPageId: mapped.pageId,
      engine: 'instatic',
    }
  }

  async getPublishedArtifact(pageId: string): Promise<PublishedArtifact> {
    const record = await this.registry.get(pageId)
    if (!record?.externalSiteId || !record.externalPageId) {
      throw new NotFoundException(`No Instatic mapping for page ${pageId}`)
    }

    const artifact = await this.artifactService.fetch(record.externalSiteId, record.externalPageId)
    return {
      pageId,
      html: artifact.html,
      meta: {
        title: artifact.title,
        description: artifact.description,
      },
      etag: artifact.etag,
      source: this.client.isMock ? 'mock' : 'instatic',
    }
  }

  async acceptPublishIntent(input: PublishIntentInput): Promise<PublishIntentResult> {
    if (!input.pageId?.trim()) {
      throw new BadRequestException('pageId is required')
    }

    let artifact: PublishedArtifact

    if (input.html?.trim()) {
      const title = input.seoTitle?.trim() || input.pageId
      artifact = {
        pageId: input.pageId,
        html: input.html,
        meta: {
          title,
          description: input.seoDescription,
        },
        etag: input.etag || createHash('sha256').update(input.html).digest('hex').slice(0, 16),
        source: this.client.isMock ? 'mock' : 'instatic',
      }
    }
    else {
      artifact = await this.getPublishedArtifact(input.pageId)
      if (input.seoTitle) artifact.meta.title = input.seoTitle
      if (input.seoDescription) artifact.meta.description = input.seoDescription
    }

    return {
      accepted: true,
      pageId: input.pageId,
      artifact,
    }
  }

  verifyBridgeRequest(rawBody: string, timestamp: string, signature: string): void {
    const ok = verifyBridgeSignature({
      secret: this.config.bridgeHmacSecret,
      rawBody,
      timestamp,
      signature,
    })
    if (!ok) {
      throw new UnauthorizedException('Invalid bridge signature')
    }
  }

  async runtimeHealth() {
    const health = await this.client.health()
    return {
      ok: health.ok,
      mock: this.client.isMock,
      protocol: 'ladipage-instatic@1',
      baseUrl: this.config.baseUrl,
      version: health.version,
      publishSource: this.config.publishSource,
    }
  }
}
