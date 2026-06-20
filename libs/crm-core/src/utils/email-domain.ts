/**
 * Extract domain from email. Returns null for invalid.
 */
export function getEmailDomain(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/i);
  return match ? match[1] : null;
}

/**
 * Check if email looks like a company (not common personal providers).
 */
export function isLikelyCompanyEmail(email: string | null | undefined): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;

  const personal = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'protonmail.com', 'aol.com', 'mail.ru', 'yandex.ru', 'qq.com',
  ];
  return !personal.includes(domain);
}