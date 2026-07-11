import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function signBridgePayload(secret: string, rawBody: string, timestamp: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
}

export function verifyBridgeSignature(input: {
  secret: string
  rawBody: string
  timestamp: string
  signature: string
  /** Max skew in seconds (default 5 minutes). */
  maxSkewSeconds?: number
}): boolean {
  const maxSkew = input.maxSkewSeconds ?? 300
  const ts = Number(input.timestamp)
  if (!Number.isFinite(ts)) return false

  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - ts) > maxSkew) return false

  const expected = signBridgePayload(input.secret, input.rawBody, input.timestamp)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(input.signature || '', 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function createSessionToken(secret: string, claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  const nonce = randomBytes(8).toString('hex')
  const body = `${payload}.${nonce}`
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySessionToken(
  secret: string,
  token: string,
): { ok: true; claims: Record<string, unknown> } | { ok: false; reason: string } {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }

  const [payload, nonce, sig] = parts
  const body = `${payload}.${nonce}`
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(sig, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' }
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >
    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: 'expired' }
    }
    return { ok: true, claims }
  }
  catch {
    return { ok: false, reason: 'bad_payload' }
  }
}
