import { BadRequestException } from '@nestjs/common'

import type { CrmCustomFieldDataType } from '@liora/database/entities/crm'
import type { CrmFieldDefinitionEntity } from '@liora/database/entities/crm'

import {
  normalizeFieldName,
  validateCustomFieldDef,
  validateCustomFieldValue,
} from './custom-field-validation'

const SLUG_RE = /^[a-z][a-z0-9_]{0,99}$/

export interface ObjectDefinitionInput {
  slug: string
  label: string
  description?: string | null
}

export interface FieldDefinitionInput {
  fieldSlug: string
  label: string
  dataType?: CrmCustomFieldDataType
  isRequired?: boolean
  options?: string[] | null
  position?: number
}

export function normalizeSlug(slug: string): string {
  return normalizeFieldName(slug)
}

export function validateObjectDefinition(input: ObjectDefinitionInput): void {
  const slug = normalizeSlug(input.slug)
  if (!SLUG_RE.test(slug)) {
    throw new BadRequestException(
      'slug must be lowercase (a-z, 0-9, underscore), start with a letter',
    )
  }
  if (!input.label?.trim()) {
    throw new BadRequestException('label is required')
  }
}

export function validateFieldDefinition(input: FieldDefinitionInput): void {
  validateCustomFieldDef({
    fieldName: input.fieldSlug,
    displayName: input.label,
    dataType: input.dataType,
    options: input.options,
  })
}

export function validateDynamicRecordData(
  fields: CrmFieldDefinitionEntity[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  const allowed = new Set(fields.map((f) => f.fieldSlug))

  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) {
      throw new BadRequestException(`Unknown field: ${key}`)
    }
  }

  for (const field of fields) {
    const raw = data[field.fieldSlug]
    const strValue =
      raw === undefined || raw === null
        ? null
        : typeof raw === 'string'
          ? raw
          : String(raw)

    validateCustomFieldValue(
      field.dataType,
      strValue,
      field.options,
      field.isRequired,
    )

    if (strValue !== null && strValue !== '') {
      normalized[field.fieldSlug] = coerceValue(field.dataType, strValue)
    } else if (field.isRequired) {
      throw new BadRequestException(`Required field missing: ${field.fieldSlug}`)
    }
  }

  return normalized
}

function coerceValue(
  dataType: CrmCustomFieldDataType,
  value: string,
): string | number | boolean {
  switch (dataType) {
    case 'NUMBER':
      return Number(value)
    case 'BOOLEAN':
      return ['true', '1'].includes(value.toLowerCase())
    default:
      return value
  }
}