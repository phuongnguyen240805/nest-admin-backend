import { Injectable } from '@nestjs/common'

import { canonicalInstaticPageId } from './instatic-ids'
import { InstaticClient } from './instatic.client'

@Injectable()
export class InstaticImportService {
  constructor(private readonly client: InstaticClient) {}

  async materialize(input: {
    pageId: string
    workspaceKey: string
    title: string
    html: string
    linkedCss?: string
    replaceIfEmpty?: boolean
    assetOrigin?: string
  }): Promise<{ siteId: string; pageId: string }> {
    const ensured = await this.client.ensurePage({
      siteKey: input.workspaceKey,
      pageKey: canonicalInstaticPageId(input.pageId),
      title: input.title,
      html: input.html,
    })

    await this.client.importHtml({
      siteId: ensured.siteId,
      pageId: ensured.pageId,
      html: input.html,
      title: input.title,
      linkedCss: input.linkedCss,
      replaceIfEmpty: input.replaceIfEmpty,
      assetOrigin: input.assetOrigin,
    })

    return { siteId: ensured.siteId, pageId: ensured.pageId }
  }
}
