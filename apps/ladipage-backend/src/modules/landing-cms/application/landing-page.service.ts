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
  DraftSavedResult,
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

    const existing = await this.registry.getForOwner(pageId, actorUserId)
    if (!existing && this.registry.hasPersistentStore()) {
      throw new NotFoundException(`Landing page ${pageId} not found`)
    }

    const siteKey = `ws_${actorUserId}`
    let siteId = existing?.externalSiteId ?? `site_${siteKey}`
    let externalPageId = existing?.externalPageId ?? `page_${pageId}`

    let recordName = existing?.name ?? pageId
    let recordSlug = existing?.slug ?? pageId

    if (!existing?.externalPageId) {
      const source = await this.registry.getImportSourceHtml(pageId)
      if (source?.html) {
        recordName = source.name || recordName
        recordSlug = source.slug || recordSlug
        const mapped = await this.importService.materialize({
          pageId,
          workspaceKey: siteKey,
          title: recordName,
          html: source.html,
        })
        siteId = mapped.siteId
        externalPageId = mapped.pageId
      }
    }

    // Best-effort registry write (columns may be missing until migration).
    await this.registry.upsert({
      pageId,
      name: recordName,
      slug: recordSlug,
      engine: 'instatic',
      externalSiteId: siteId,
      externalPageId,
      ownerUserId: actorUserId,
      externalWorkspaceId: siteKey,
    })

    const session = this.sso.mint({
      pageId,
      actorUserId,
      externalSiteId: siteId,
      externalPageId,
      workspaceId: siteKey,
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

    const existing = await this.registry.getForOwner(input.pageId, input.actorUserId)
    if (!existing && this.registry.hasPersistentStore()) {
      throw new NotFoundException(`Landing page ${input.pageId} not found`)
    }

    const workspaceKey = `ws_${input.actorUserId}`
    const title = input.name?.trim() || existing?.name || input.pageId

    const mapped = await this.importService.materialize({
      pageId: input.pageId,
      workspaceKey,
      title,
      html: input.html,
    })

    await this.registry.upsert({
      pageId: input.pageId,
      name: title,
      slug: input.slug?.trim() || existing?.slug || input.pageId,
      engine: 'instatic',
      externalSiteId: mapped.siteId,
      externalPageId: mapped.pageId,
      ownerUserId: input.actorUserId,
      externalWorkspaceId: workspaceKey,
    })

    return {
      pageId: input.pageId,
      externalSiteId: mapped.siteId,
      externalPageId: mapped.pageId,
      engine: 'instatic',
    }
  }

  async getPublishedArtifact(pageId: string, actorUserId: number): Promise<PublishedArtifact> {
    const record = await this.registry.getForOwner(pageId, actorUserId)
    if (!record?.externalSiteId || !record.externalPageId) {
      throw new NotFoundException(`No Instatic mapping for page ${pageId}`)
    }

    return this.fetchArtifactForRecord(pageId, record.externalSiteId, record.externalPageId)
  }

  async acceptPublishIntent(input: PublishIntentInput): Promise<PublishIntentResult> {
    if (!input.pageId?.trim()) {
      throw new BadRequestException('pageId is required')
    }

    let artifact: PublishedArtifact
    let artifactExternalPageId = input.externalPageId ?? null

    if (input.html?.trim()) {
      const record = await this.registry.get(input.pageId)
      if (
        record?.externalPageId &&
        input.externalPageId &&
        input.externalPageId !== record.externalPageId
      ) {
        throw new BadRequestException('externalPageId does not match page mapping')
      }
      artifactExternalPageId = input.externalPageId ?? record?.externalPageId ?? null
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
      const record = await this.registry.get(input.pageId)
      if (!record?.externalSiteId || !record.externalPageId) {
        throw new NotFoundException(`No Instatic mapping for page ${input.pageId}`)
      }
      if (input.externalPageId && input.externalPageId !== record.externalPageId) {
        throw new BadRequestException('externalPageId does not match page mapping')
      }
      artifactExternalPageId = record.externalPageId

      artifact = await this.fetchArtifactForRecord(
        input.pageId,
        record.externalSiteId,
        record.externalPageId,
      )
      if (input.seoTitle) artifact.meta.title = input.seoTitle
      if (input.seoDescription) artifact.meta.description = input.seoDescription
    }

    await this.registry.persistPublishedArtifact({
      pageId: input.pageId,
      externalPageId: artifactExternalPageId,
      html: artifact.html,
      meta: artifact.meta,
      etag: artifact.etag,
    })

    return {
      accepted: true,
      pageId: input.pageId,
      artifact,
    }
  }

  async acceptDraftSaved(input: PublishIntentInput): Promise<DraftSavedResult> {
    if (!input.pageId?.trim()) {
      throw new BadRequestException('pageId is required')
    }
    if (!input.html?.trim()) {
      throw new BadRequestException('html is required')
    }

    const record = await this.registry.get(input.pageId)
    if (
      record?.externalPageId &&
      input.externalPageId &&
      input.externalPageId !== record.externalPageId
    ) {
      throw new BadRequestException('externalPageId does not match page mapping')
    }

    const title = input.seoTitle?.trim() || record?.name || input.pageId
    const etag =
      input.etag || createHash('sha256').update(input.html).digest('hex').slice(0, 16)

    await this.registry.persistDraftArtifact({
      pageId: input.pageId,
      externalPageId: input.externalPageId ?? record?.externalPageId ?? null,
      html: input.html,
      meta: {
        title,
        description: input.seoDescription,
      },
      etag,
    })

    return {
      accepted: true,
      pageId: input.pageId,
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

  private async fetchArtifactForRecord(
    pageId: string,
    externalSiteId: string,
    externalPageId: string,
  ): Promise<PublishedArtifact> {
    const artifact = await this.artifactService.fetch(externalSiteId, externalPageId)
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
}
