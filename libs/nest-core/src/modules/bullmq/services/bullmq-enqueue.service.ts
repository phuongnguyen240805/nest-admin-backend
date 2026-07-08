import { getQueueToken } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { Job, JobsOptions, Queue } from 'bullmq'

@Injectable()
export class BullMqEnqueueService {
  private readonly logger = new Logger(BullMqEnqueueService.name)

  constructor(private readonly moduleRef: ModuleRef) {}

  private resolveQueue(queueName: string): Queue {
    const token = getQueueToken(queueName)
    const queue = this.moduleRef.get<Queue>(token, { strict: false })
    if (!queue) {
      throw new Error(`BullMQ queue "${queueName}" is not registered`)
    }
    return queue
  }

  async add<T>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.resolveQueue(queueName)
    const job = await queue.add(jobName, data, opts)
    this.logger.debug(`Enqueued ${queueName}/${jobName} id=${job.id}`)
    return job
  }

  async addDelayed<T>(
    queueName: string,
    jobName: string,
    data: T,
    delayMs: number,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    return this.add(queueName, jobName, data, { ...opts, delay: delayMs })
  }

  async cancel(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId)
    if (!job) return false
    await job.remove()
    return true
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.resolveQueue(queueName)
    return (await queue.getJob(jobId)) ?? undefined
  }
}