import { AdsFingerprintService } from './ads-fingerprint.service'

describe('AdsFingerprintService', () => {
  const service = new AdsFingerprintService()

  it('produces the same hash for objects with different key order', () => {
    expect(service.hash({ accountId: '1', metrics: { spend: 10, clicks: 2 } })).toBe(
      service.hash({ metrics: { clicks: 2, spend: 10 }, accountId: '1' }),
    )
  })

  it('keeps array order significant and ignores undefined object fields', () => {
    expect(service.hash({ values: [1, 2] })).not.toBe(service.hash({ values: [2, 1] }))
    expect(service.hash({ accountId: '1', ignored: undefined })).toBe(
      service.hash({ accountId: '1' }),
    )
  })
})

