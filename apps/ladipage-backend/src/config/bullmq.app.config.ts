import { buildRedisOptions } from '@liora/database/utils/connection-url.util'
import type { BullMqConnectionOptions, BullMqRootOptions } from '@liora/nest-core'

export function isBullMqEnabled(): boolean {
  return process.env.BULLMQ_ENABLED !== 'false'
}

/** When false, API process only enqueues — processors run in ladipage-ai-worker. */
export function isBullMqWorkerEnabled(): boolean {
  return isBullMqEnabled() && process.env.BULLMQ_RUN_WORKERS !== 'false'
}

function buildConnectionOptions(): BullMqConnectionOptions {
  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    return { url: redisUrl }
  }

  const redis = buildRedisOptions()
  return {
    host: redis.host,
    port: redis.port,
    password: redis.password,
    db: redis.db,
  }
}

export function buildLadipageBullMqOptions(): BullMqRootOptions {
  return {
    connection: buildConnectionOptions(),
    prefix: process.env.BULLMQ_PREFIX ?? 'liora:ladipage',
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  }
}