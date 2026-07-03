import { Inject, Injectable, Optional, forwardRef } from '@nestjs/common'

import { AiSeoProjectService } from '../ai-seo/services/ai-seo-project.service'

@Injectable()
export class PublishService {
  constructor(
    @Optional()
    @Inject(forwardRef(() => AiSeoProjectService))
    private readonly aiSeoProjectService?: AiSeoProjectService,
  ) {}

  async startPublish(funnelId: string, userId: number) {
    return { jobId: 'demo-' + Date.now(), status: 'queued' }
  }

  async onLandingPagePublished(pageId: string, storeId?: string) {
    if (!this.aiSeoProjectService) return null
    return this.aiSeoProjectService.ensureForLandingPage(pageId, storeId)
  }
}