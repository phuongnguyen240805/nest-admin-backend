import {
  createPublishSignature,
  verifyPublishSignature,
} from './publish-signature'

describe('publish signature', () => {
  const secret = 'x'.repeat(32)
  const body = JSON.stringify({ jobId: 'pub_1', pageId: 'p1' })
  const timestamp = '1700000000000'

  it('verifies a valid signed body', () => {
    const signature = createPublishSignature(secret, timestamp, body)
    expect(
      verifyPublishSignature({
        secret,
        timestamp,
        signature,
        body,
        now: Number(timestamp),
      }),
    ).toBe(true)
  })

  it('rejects a tampered body', () => {
    const signature = createPublishSignature(secret, timestamp, body)
    expect(
      verifyPublishSignature({
        secret,
        timestamp,
        signature,
        body: `${body} `,
        now: Number(timestamp),
      }),
    ).toBe(false)
  })

  it('rejects stale signatures', () => {
    const signature = createPublishSignature(secret, timestamp, body)
    expect(
      verifyPublishSignature({
        secret,
        timestamp,
        signature,
        body,
        now: Number(timestamp) + 10 * 60_000,
      }),
    ).toBe(false)
  })
})
