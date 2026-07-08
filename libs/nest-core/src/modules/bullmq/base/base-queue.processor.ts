import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'

export abstract class BaseQueueProcessor<T = unknown> extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name)

  async process(job: Job<T>): Promise<void> {
    const startedAt = Date.now()
    this.logger.log(`Processing job ${job.id} on queue ${job.queueName}`)
    try {
      await this.processJob(job)
      this.logger.log(
        `Job ${job.id} completed in ${Date.now() - startedAt}ms`,
      )
    }
    catch (error) {
      this.logger.error(`Job ${job.id} failed`, error instanceof Error ? error.stack : error)
      throw error
    }
  }

  protected abstract processJob(job: Job<T>): Promise<void>

  protected async updateProgress(job: Job, progress: number): Promise<void> {
    await job.updateProgress(Math.max(0, Math.min(100, progress)))
  }
}