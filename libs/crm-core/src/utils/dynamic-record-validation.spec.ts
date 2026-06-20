import { BadRequestException } from '@nestjs/common'

import type { CrmFieldDefinitionEntity } from '@liora/database/entities/crm'

import {
  validateDynamicRecordData,
  validateFieldDefinition,
  validateObjectDefinition,
} from './dynamic-record-validation'

describe('dynamic-record-validation', () => {
  const fields: CrmFieldDefinitionEntity[] = [
    {
      id: 'f1',
      objectId: 'obj1',
      fieldSlug: 'title',
      label: 'Title',
      dataType: 'TEXT',
      isRequired: true,
      options: null,
      position: 0,
    },
    {
      id: 'f2',
      objectId: 'obj1',
      fieldSlug: 'amount',
      label: 'Amount',
      dataType: 'NUMBER',
      isRequired: false,
      options: null,
      position: 1,
    },
    {
      id: 'f3',
      objectId: 'obj1',
      fieldSlug: 'status',
      label: 'Status',
      dataType: 'LIST',
      isRequired: false,
      options: ['open', 'closed'],
      position: 2,
    },
  ]

  describe('validateObjectDefinition', () => {
    it('accepts valid slug and label', () => {
      expect(() =>
        validateObjectDefinition({ slug: 'my_object', label: 'My Object' }),
      ).not.toThrow()
    })

    it('rejects invalid slug', () => {
      expect(() =>
        validateObjectDefinition({ slug: '123bad', label: 'X' }),
      ).toThrow(BadRequestException)
    })
  })

  describe('validateFieldDefinition', () => {
    it('rejects LIST without options', () => {
      expect(() =>
        validateFieldDefinition({
          fieldSlug: 'pick',
          label: 'Pick',
          dataType: 'LIST',
        }),
      ).toThrow(BadRequestException)
    })
  })

  describe('validateDynamicRecordData', () => {
    it('validates and coerces values', () => {
      const result = validateDynamicRecordData(fields, {
        title: 'Hello',
        amount: '42',
        status: 'open',
      })
      expect(result).toEqual({
        title: 'Hello',
        amount: 42,
        status: 'open',
      })
    })

    it('rejects unknown fields', () => {
      expect(() =>
        validateDynamicRecordData(fields, { title: 'x', extra: 'y' }),
      ).toThrow(BadRequestException)
    })

    it('rejects missing required field', () => {
      expect(() => validateDynamicRecordData(fields, { amount: '1' })).toThrow(
        BadRequestException,
      )
    })

    it('rejects invalid LIST value', () => {
      expect(() =>
        validateDynamicRecordData(fields, {
          title: 'x',
          status: 'invalid',
        }),
      ).toThrow(BadRequestException)
    })
  })
})