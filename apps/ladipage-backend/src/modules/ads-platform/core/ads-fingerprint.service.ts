import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'

@Injectable()
export class AdsFingerprintService {
  hash(value: unknown): string {
    return createHash('sha256').update(this.stableSerialize(value)).digest('hex')
  }

  stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${this.stableSerialize(child)}`)
    return `{${entries.join(',')}}`
  }
}
