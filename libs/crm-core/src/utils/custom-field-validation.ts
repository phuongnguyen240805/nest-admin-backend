import { BadRequestException } from '@nestjs/common'

import type {
  CrmCustomFieldDataType,
  CrmCustomFieldTargetType,
} from '@liora/database/entities/crm'

const FIELD_NAME_RE = /^[a-z][a-z0-9_]{0,99}$/

export interface CustomFieldDefInput {
  targetType?: CrmCustomFieldTargetType
  fieldName: string
  displayName: string
  dataType?: CrmCustomFieldDataType
  description?: string | null
  options?: string[] | null
  isRequired?: boolean
}

export function normalizeFieldName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export function validateCustomFieldDef(input: CustomFieldDefInput): void {
  const fieldName = normalizeFieldName(input.fieldName)
  if (!FIELD_NAME_RE.test(fieldName)) {
    throw new BadRequestException(
      'fieldName must be lowercase slug (a-z, 0-9, underscore), start with a letter',
    )
  }

  if (!input.displayName?.trim()) {
    throw new BadRequestException('displayName is required')
  }

  const dataType = input.dataType ?? 'TEXT'

  if (dataType === 'LIST') {
    if (!input.options?.length) {
      throw new BadRequestException('LIST fields require at least one option')
    }
  }

  if (input.targetType && !['person', 'opportunity'].includes(input.targetType)) {
    throw new BadRequestException('targetType must be person or opportunity')
  }
}

export function validateCustomFieldValue(
  dataType: CrmCustomFieldDataType,
  value: string | null | undefined,
  options?: string[] | null,
  isRequired?: boolean,
): void {
  const raw = value ?? null

  if (isRequired && (raw === null || raw === '')) {
    throw new BadRequestException('Required custom field value is missing')
  }

  if (raw === null || raw === '') return

  switch (dataType) {
    case 'NUMBER':
      if (Number.isNaN(Number(raw))) {
        throw new BadRequestException('Value must be a number')
      }
      break
    case 'BOOLEAN':
      if (!['true', 'false', '1', '0'].includes(raw.toLowerCase())) {
        throw new BadRequestException('Value must be true or false')
      }
      break
    case 'DATE':
      if (Number.isNaN(Date.parse(raw))) {
        throw new BadRequestException('Value must be a valid date')
      }
      break
    case 'LIST':
      if (options?.length && !options.includes(raw)) {
        throw new BadRequestException('Value must be one of the field options')
      }
      break
    default:
      break
  }
}