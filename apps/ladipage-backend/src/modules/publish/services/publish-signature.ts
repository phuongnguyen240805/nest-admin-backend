import { createHmac, timingSafeEqual } from 'node:crypto'

export const PUBLISH_SIGNATURE_HEADER = 'x-liora-publish-signature'
export const PUBLISH_TIMESTAMP_HEADER = 'x-liora-publish-timestamp'
export const PUBLISH_SIGNATURE_MAX_SKEW_MS = 5 * 60_000

export function createPublishSignature(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verifyPublishSignature(input: {
  secret: string
  timestamp: string | undefined
  signature: string | undefined
  body: string
  now?: number
}): boolean {
  const timestampMs = Number(input.timestamp)
  if (!input.timestamp || !input.signature || !Number.isFinite(timestampMs)) return false
  if (Math.abs((input.now ?? Date.now()) - timestampMs) > PUBLISH_SIGNATURE_MAX_SKEW_MS) return false

  const expected = createPublishSignature(input.secret, input.timestamp, input.body)
  if (expected.length !== input.signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(input.signature, 'utf8'))
  }
  catch {
    return false
  }
}
