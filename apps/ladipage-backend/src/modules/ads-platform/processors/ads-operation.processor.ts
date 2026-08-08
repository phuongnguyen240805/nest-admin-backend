import { BaseQueueProcessor, BullMqProcessor } from '@liora/nest-core'
import type { Job } from 'bullmq'

import { ADS_PLATFORM_QUEUES, type AdsQueuePayload } from '../queues/constants'
import { AdsWorkflowExecutorService } from '../services/ads-workflow-executor.service'

@BullMqProcessor(ADS_PLATFORM_QUEUES.OPERATIONS)
export class AdsOperationProcessor extends BaseQueueProcessor<AdsQueuePayload> {
  constructor(private readonly executor: AdsWorkflowExecutorService) {
    super()
  }

  protected async processJob(job: Job<AdsQueuePayload>): Promise<void> {
    await this.executor.execute(job.data.jobId)
  }
}
