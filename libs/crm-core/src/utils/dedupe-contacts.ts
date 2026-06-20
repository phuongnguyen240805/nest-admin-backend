import { parseName } from './parse-name';

export interface ContactCandidate {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface DedupedContact extends ContactCandidate {
  // Can be extended later with score etc.
}

/**
 * Simple deduplication helper (inspired by contact-creation-manager patterns).
 * Prefers phone > email > normalized name.
 * Returns the best candidate or merged signals (for service layer to decide create/update).
 */
export function dedupeContacts(
  existing: ContactCandidate[],
  incoming: ContactCandidate,
): { match: ContactCandidate | null; score: number } {
  if (!incoming) {
    return { match: null, score: 0 };
  }

  const normEmail = (incoming.email || '').toLowerCase().trim();
  const normPhone = (incoming.phone || '').replace(/\D/g, '');

  for (const ex of existing) {
    const exPhone = (ex.phone || '').replace(/\D/g, '');
    const exEmail = (ex.email || '').toLowerCase().trim();

    if (normPhone && exPhone && normPhone === exPhone) {
      return { match: ex, score: 100 };
    }
    if (normEmail && exEmail && normEmail === exEmail) {
      return { match: ex, score: 90 };
    }

    // loose name match
    const incName = parseName(incoming.name).fullName.toLowerCase();
    const exName = parseName(ex.name).fullName.toLowerCase();
    if (incName && exName && incName === exName) {
      return { match: ex, score: 60 };
    }
  }

  return { match: null, score: 0 };
}