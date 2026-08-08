import { Injectable } from '@nestjs/common'

const SENSITIVE_KEY = /(authorization|access.?token|refresh.?token|secret|cookie|fb_dtsg|\blsd\b|csrf|ms.?token|x.?bogus|password|api.?key)/i
const TOKEN_TEXT = /\b(EAA[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~-]+)\b/gi

@Injectable()
export class AdsRedactionService {
  redact<T>(value: T): T {
    return this.visit(value, new WeakSet<object>()) as T
  }

  private visit(value: unknown, seen: WeakSet<object>): unknown {
    if (typeof value === 'string') return value.replace(TOKEN_TEXT, '[REDACTED]')
    if (value == null || typeof value !== 'object') return value
    if (seen.has(value)) return '[CIRCULAR]'
    seen.add(value)

    if (Array.isArray(value)) return value.map((item) => this.visit(item, seen))

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : this.visit(child, seen),
      ]),
    )
  }
}
