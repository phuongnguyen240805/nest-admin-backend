import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'

type CacheEntry = {
  expiresAt: number
  value: unknown
}

@Injectable()
export class AiSeoCacheService {
  private readonly cache = new Map<string, CacheEntry>()

  buildSeedHash(input: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex')
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  set(key: string, value: unknown, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }
}
