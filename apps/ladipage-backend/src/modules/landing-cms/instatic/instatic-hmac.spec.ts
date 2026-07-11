import {
  createSessionToken,
  signBridgePayload,
  verifyBridgeSignature,
  verifySessionToken,
} from './instatic-hmac'

describe('instatic-hmac', () => {
  const secret = 'test-bridge-secret'

  it('signs and verifies bridge payload', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const rawBody = JSON.stringify({ pageId: 'p1' })
    const signature = signBridgePayload(secret, rawBody, timestamp)

    expect(
      verifyBridgeSignature({ secret, rawBody, timestamp, signature }),
    ).toBe(true)
  })

  it('rejects tampered body', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = signBridgePayload(secret, '{"pageId":"p1"}', timestamp)

    expect(
      verifyBridgeSignature({
        secret,
        rawBody: '{"pageId":"p2"}',
        timestamp,
        signature,
      }),
    ).toBe(false)
  })

  it('rejects skewed timestamp', () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 10_000)
    const rawBody = '{}'
    const signature = signBridgePayload(secret, rawBody, timestamp)

    expect(
      verifyBridgeSignature({ secret, rawBody, timestamp, signature, maxSkewSeconds: 300 }),
    ).toBe(false)
  })

  it('mints and verifies session token', () => {
    const token = createSessionToken(secret, {
      sub: '42',
      pageId: 'abc',
      exp: Math.floor(Date.now() / 1000) + 600,
    })
    const result = verifySessionToken(secret, token)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.claims.pageId).toBe('abc')
      expect(result.claims.sub).toBe('42')
    }
  })

  it('rejects expired session token', () => {
    const token = createSessionToken(secret, {
      sub: '1',
      exp: Math.floor(Date.now() / 1000) - 10,
    })
    const result = verifySessionToken(secret, token)
    expect(result.ok).toBe(false)
  })
})
