import { getEmailDomain, isLikelyCompanyEmail } from './email-domain';

describe('email domain utils', () => {
  it('extracts domain', () => {
    expect(getEmailDomain('user@acme-corp.com')).toBe('acme-corp.com');
    expect(getEmailDomain('USER@GMAIL.COM')).toBe('gmail.com');
    expect(getEmailDomain('bad')).toBeNull();
  });

  it('detects likely company email', () => {
    expect(isLikelyCompanyEmail('sales@acme.vn')).toBe(true);
    expect(isLikelyCompanyEmail('john@gmail.com')).toBe(false);
    expect(isLikelyCompanyEmail(null)).toBe(false);
  });
});