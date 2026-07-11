import { Injectable } from '@nestjs/common'

import { InstaticClient } from './instatic.client'

@Injectable()
export class InstaticArtifactService {
  constructor(private readonly client: InstaticClient) {}

  fetch(siteId: string, pageId: string) {
    return this.client.fetchPublishedArtifact({ siteId, pageId })
  }
}
