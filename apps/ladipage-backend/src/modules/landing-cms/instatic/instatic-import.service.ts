import { Injectable } from '@nestjs/common'

import { InstaticClient } from './instatic.client'

@Injectable()
export class InstaticImportService {
  constructor(private readonly client: InstaticClient) {}

  async materialize(input: {
    pageId: string
    workspaceKey: string
    title: string
    html: string
  }): Promise<{ siteId: string; pageId: string }> {
    const ensured = await this.client.ensurePage({
      siteKey: input.workspaceKey,
      pageKey: input.pageId,
      title: input.title,
      html: input.html,
    })

    await this.client.importHtml({
      siteId: ensured.siteId,
      pageId: ensured.pageId,
      html: input.html,
      title: input.title,
    })

    return { siteId: ensured.siteId, pageId: ensured.pageId }
  }
}
