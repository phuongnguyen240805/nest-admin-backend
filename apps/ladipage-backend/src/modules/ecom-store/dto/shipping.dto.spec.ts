import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

jest.mock('@nestjs/swagger', () => new Proxy({}, {
  get: () => () => () => undefined,
}))

import { SHIPPING_PROVIDERS } from '../shipping/core'
import { ShippingQuoteDto } from './shipping.dto'

describe('ShippingQuoteDto provider validation', () => {
  it.each(SHIPPING_PROVIDERS)('accepts registered provider %s', async (provider) => {
    const dto = plainToInstance(ShippingQuoteDto, {
      provider,
      recipientName: 'Nguyen Van A',
      recipientPhone: '0900000000',
      address: {
        address: '1 Nguyen Trai',
        province: 'Ho Chi Minh',
        district: 'District 1',
        ward: 'Ben Nghe',
      },
    })

    expect(await validate(dto)).toHaveLength(0)
  })

  it('rejects providers outside the registry contract', async () => {
    const dto = plainToInstance(ShippingQuoteDto, {
      provider: 'unknown_carrier',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0900000000',
      address: {
        address: '1 Nguyen Trai',
        province: 'Ho Chi Minh',
        district: 'District 1',
        ward: 'Ben Nghe',
      },
    })

    const errors = await validate(dto)
    expect(errors.some((error) => error.property === 'provider')).toBe(true)
  })
})
