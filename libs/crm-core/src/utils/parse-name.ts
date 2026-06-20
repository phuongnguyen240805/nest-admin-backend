export interface ParsedName {
  firstName: string;
  lastName: string;
  fullName: string;
}

/**
 * Parse a full name string into first/last name.
 * Twenty-inspired simple version (no heavy lib).
 */
export function parseName(fullName: string | null | undefined): ParsedName {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '', fullName: '' };
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '', fullName: '' };
  }

  // Normalize all whitespace (including multiple spaces) to single space
  const normalized = trimmed.replace(/\s+/g, ' ');
  const parts = normalized.split(' ');

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', fullName: normalized };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  return { firstName, lastName, fullName: normalized };
}