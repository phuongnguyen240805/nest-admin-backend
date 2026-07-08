import type { ConnectionOptions } from 'bullmq'

import type { BullMqConnectionOptions } from './bullmq.types'

export function buildBullMqConnection(
  options: BullMqConnectionOptions,
): ConnectionOptions {
  if (options.url) {
    return { url: options.url }
  }

  return {
    host: options.host ?? '127.0.0.1',
    port: options.port ?? 6379,
    password: options.password,
    db: options.db,
  }
}