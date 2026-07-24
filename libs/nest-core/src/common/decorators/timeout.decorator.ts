import { SetMetadata } from '@nestjs/common'

export const REQUEST_TIMEOUT_MS_KEY = Symbol('__request_timeout_ms__')

export function RequestTimeoutMs(ms: number) {
  return SetMetadata(REQUEST_TIMEOUT_MS_KEY, ms)
}
