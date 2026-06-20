import { dedupeContacts } from './dedupe-contacts';

describe('dedupeContacts', () => {
  const existing = [
    { name: 'Nguyen Van A', phone: '0901234567', email: 'a@acme.com' },
    { name: 'B Tran', phone: '0912345678', email: 'b@gmail.com' },
  ];

  it('matches by phone', () => {
    const res = dedupeContacts(existing, { name: 'A Nguyen', phone: '0901234567' });
    expect(res.score).toBe(100);
    expect(res.match?.email).toBe('a@acme.com');
  });

  it('matches by email', () => {
    const res = dedupeContacts(existing, { email: 'b@gmail.com' });
    expect(res.score).toBe(90);
  });

  it('returns no match for new contact', () => {
    const res = dedupeContacts(existing, { name: 'New Person', email: 'new@other.io', phone: '0999999999' });
    expect(res.match).toBeNull();
    expect(res.score).toBe(0);
  });
});