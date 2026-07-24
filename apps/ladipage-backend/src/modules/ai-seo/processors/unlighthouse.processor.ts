import { BullMqProcessor, BaseQueueProcessor } from '@liora/nest-core'
import type { Job } from 'bullmq'

import { AI_SEO_QUEUES } from '../queues/constants'
import type { UnlighthouseJobPayload } from '../types/unlighthouse-job.payload'
import { LabScanService } from '../services/lab-scan.service'

@BullMqProcessor(AI_SEO_QUEUES.LIGHTHOUSE)
export class UnlighthouseProcessor extends BaseQueueProcessor<UnlighthouseJobPayload> {
  constructor(private readonly labScanService: LabScanService) {
    super()
  }

  protected async processJob(job: Job<UnlighthouseJobPayload>): Promise<void> {
    const data = job.data
    this.logger.log(
      `ai_seo_lighthouse job=${data.jobId} tenant=${data.tenantId} url=${data.targetUrl} trigger=${data.trigger}`,
    )
    await this.labScanService.processPayload(data)
    await this.updateProgress(job, 100)
  }
}
