import type { JobsOptions } from 'bullmq'

export interface BullMqConnectionOptions {
  url?: string
  host?: string
  port?: number
  password?: string
  db?: number
}

export interface BullMqRootOptions {
  connection: BullMqConnectionOptions
  prefix: string
  defaultJobOptions?: JobsOptions
}

export interface QueueRegisterOptions {
  name: string
  defaultJobOptions?: JobsOptions
}

export interface BaseJobPayload {
  jobId: string
  tenantId: number
  userId: string
}