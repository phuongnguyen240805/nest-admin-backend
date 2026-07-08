import { BullMqProcessor, BaseQueueProcessor } from '@liora/nest-core'
import type { Job } from 'bullmq'

import { LANDING_AI_QUEUES } from '../queues/constants'
import { LandingAiJobStoreService } from '../services/landing-ai-job-store.service'

/** Stub processor — AI Copilot update flow (phase sau). */
@BullMqProcessor(LANDING_AI_QUEUES.UPDATE)
export class LandingAiUpdateProcessor extends BaseQueueProcessor<Record<string, unknown>> {
  constructor(private readonly jobStore: LandingAiJobStoreService) {
    super()
  }

  protected async processJob(job: Job<Record<string, unknown>>): Promise<void> {
    const jobId = String(job.data.jobId ?? job.id)
    await this.jobStore.appendEvent(jobId, 'Landing AI update processor is not implemented yet')
    throw new Error('landing-ai-update processor is not implemented yet')
  }
}