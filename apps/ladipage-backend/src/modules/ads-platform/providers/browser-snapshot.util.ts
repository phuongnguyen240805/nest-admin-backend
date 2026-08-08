import { BadRequestException } from '@nestjs/common'

const FORBIDDEN_BROWSER_FIELD = /(authorization|access.?token|refresh.?token|secret|cookie|fb_dtsg|\blsd\b|csrf|ms.?token|x.?bogus|password|api.?key|raw.?html)/i

export function assertCredentialFreeSnapshot(value: unknown, path = 'payload'): void {
  if (value == null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCredentialFreeSnapshot(item, `${path}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_BROWSER_FIELD.test(key)) {
      throw new BadRequestException(`Browser snapshot contains forbidden field at ${path}.${key}`)
    }
    assertCredentialFreeSnapshot(child, `${path}.${key}`)
  }
}
