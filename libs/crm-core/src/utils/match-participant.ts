/**
 * Twenty-inspired email participant match helper for TypeORM queries.
 * Builds ILIKE-safe filter on primary_email or JSONB emails array.
 */
export function buildEmailParticipantFilter(
  alias: string,
  email: string,
): { clause: string; params: Record<string, string> } {
  const normalized = email.trim().toLowerCase()
  return {
    clause: `(
      LOWER(${alias}.primary_email) = :participantEmail
      OR ${alias}.emails @> :participantEmailJson::jsonb
    )`,
    params: {
      participantEmail: normalized,
      participantEmailJson: JSON.stringify([{ value: normalized }]),
    },
  }
}