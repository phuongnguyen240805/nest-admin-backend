/** Twenty-inspired composite types stored as JSONB */

export interface CrmEmailEntry {
  value: string
  isPrimary?: boolean
}

export interface CrmPhoneEntry {
  value: string
  isPrimary?: boolean
}

export interface CrmLinkEntry {
  url?: string
  label?: string
}

export type CrmPersonStatus = 'ACTIVE' | 'BLOCKED'

export interface CrmCurrencyAmount {
  amountMicros: number
  currencyCode: 'VND' | 'USD'
}

export type CrmTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'

export type CrmActivityAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'STAGE_CHANGED'

export type CrmActivityTargetType = 'person' | 'opportunity' | 'task' | 'note'

/** Default sales pipeline stage slugs (seeded per tenant). */
export type CrmCustomFieldTargetType = 'person' | 'opportunity'

export type CrmCustomFieldDataType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'LIST'
  | 'BOOLEAN'

export const DEFAULT_PIPELINE_STAGES = [
  { slug: 'new', name: 'New', position: 0, color: '#6B7280' },
  { slug: 'qualified', name: 'Qualified', position: 1, color: '#3B82F6' },
  { slug: 'proposal', name: 'Proposal', position: 2, color: '#8B5CF6' },
  { slug: 'won', name: 'Won', position: 3, color: '#10B981' },
  { slug: 'lost', name: 'Lost', position: 4, color: '#EF4444' },
] as const