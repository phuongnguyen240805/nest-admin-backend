import { BadRequestException } from '@nestjs/common'

import { assertCredentialFreeSnapshot } from './browser-snapshot.util'

describe('assertCredentialFreeSnapshot', () => {
  it('accepts credential-free supplemental data', () => {
    expect(() =>
      assertCredentialFreeSnapshot({ route: '/campaigns', metrics: [{ spend: 12 }] }),
    ).not.toThrow()
  })

  it.each(['accessToken', 'cookie', 'fb_dtsg', 'xBogus', 'csrfToken', 'rawHtml'])(
    'rejects forbidden field %s at any depth',
    (field) => {
      expect(() => assertCredentialFreeSnapshot({ nested: { [field]: 'secret' } })).toThrow(
        BadRequestException,
      )
    },
  )
})
