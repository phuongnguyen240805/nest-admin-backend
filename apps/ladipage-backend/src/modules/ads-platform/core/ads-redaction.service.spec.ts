import { AdsRedactionService } from './ads-redaction.service'

describe('AdsRedactionService', () => {
  it('redacts nested platform credentials without changing safe fields', () => {
    const service = new AdsRedactionService()
    expect(
      service.redact({
        accountId: '123',
        accessToken: 'EAA-secret-value',
        headers: { Authorization: 'Bearer token.value', 'x-csrftoken': 'csrf' },
      }),
    ).toEqual({
      accountId: '123',
      accessToken: '[REDACTED]',
      headers: { Authorization: '[REDACTED]', 'x-csrftoken': '[REDACTED]' },
    })
  })
})
