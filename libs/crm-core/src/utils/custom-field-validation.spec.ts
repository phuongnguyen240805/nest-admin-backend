import { BadRequestException } from '@nestjs/common'

import {
  normalizeFieldName,
  validateCustomFieldDef,
  validateCustomFieldValue,
} from './custom-field-validation'

describe('custom-field-validation', () => {
  it('normalizes field name to slug', () => {
    expect(normalizeFieldName('My Field!')).toBe('my_field')
  })

  it('requires options for LIST type', () => {
    expect(() =>
      validateCustomFieldDef({
        fieldName: 'status',
        displayName: 'Status',
        dataType: 'LIST',
        options: [],
      }),
    ).toThrow(BadRequestException)
  })

  it('validates LIST value against options', () => {
    expect(() =>
      validateCustomFieldValue('LIST', 'invalid', ['A', 'B']),
    ).toThrow(BadRequestException)

    expect(() => validateCustomFieldValue('LIST', 'A', ['A', 'B'])).not.toThrow()
  })

  it('validates required values', () => {
    expect(() =>
      validateCustomFieldValue('TEXT', '', null, true),
    ).toThrow(BadRequestException)
  })
})