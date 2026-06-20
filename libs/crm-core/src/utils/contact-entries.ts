import type { CrmEmailEntry, CrmPhoneEntry } from '@liora/database/entities/crm'

export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  return trimmed || null
}

export function toEmailEntries(email?: string | null): CrmEmailEntry[] {
  const value = normalizeEmail(email)
  if (!value) return []
  return [{ value, isPrimary: true }]
}

export function toPhoneEntries(phone?: string | null): CrmPhoneEntry[] {
  const raw = (phone ?? '').trim()
  if (!raw) return []
  return [{ value: raw, isPrimary: true }]
}

export function getPrimaryEmail(emails: CrmEmailEntry[]): string | null {
  const primary = emails.find((e) => e.isPrimary) ?? emails[0]
  return primary?.value ?? null
}

export function getPrimaryPhone(phones: CrmPhoneEntry[]): string | null {
  const primary = phones.find((p) => p.isPrimary) ?? phones[0]
  return primary?.value ?? null
}