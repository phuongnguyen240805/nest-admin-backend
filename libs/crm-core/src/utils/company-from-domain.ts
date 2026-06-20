import { getEmailDomain } from './email-domain';

/**
 * Derive a reasonable company name from domain.
 * e.g. "acme-corp.com" → "Acme Corp"
 */
export function companyNameFromDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const clean = domain
    .replace(/^www\./, '')
    .replace(/\.(com|co|io|vn|net|org|dev)$/i, '')
    .replace(/[-_.]/g, ' ')
    .trim();

  if (!clean) return null;

  return clean
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Suggest company from email domain if it looks corporate.
 */
export function suggestCompanyFromEmail(email: string | null | undefined): string | null {
  const domain = getEmailDomain(email);
  if (!domain || !email) return null;

  // If personal domain, don't suggest
  // (reuse isLikelyCompanyEmail logic lightly)
  return companyNameFromDomain(domain);
}