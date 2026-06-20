import {
  getPrimaryEmail,
  getPrimaryPhone,
  normalizePhone,
  toEmailEntries,
  toPhoneEntries,
} from './contact-entries'

describe('contact-entries', () => {
  it('normalizes phone digits', () => {
    expect(normalizePhone('090-123-4567')).toBe('0901234567')
  })

  it('builds primary email entry', () => {
    const entries = toEmailEntries('A@Acme.COM')
    expect(entries).toEqual([{ value: 'a@acme.com', isPrimary: true }])
    expect(getPrimaryEmail(entries)).toBe('a@acme.com')
  })

  it('builds primary phone entry', () => {
    const entries = toPhoneEntries('0901234567')
    expect(getPrimaryPhone(entries)).toBe('0901234567')
  })
})