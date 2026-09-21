import { HttpException } from '@nestjs/common';

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const row = error as { code?: unknown; driverError?: { code?: unknown } };
  return String(row.code || row.driverError?.code || '');
}

function errorConstraint(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const row = error as {
    constraint?: unknown;
    driverError?: { constraint?: unknown };
    message?: unknown;
  };
  return String(
    row.constraint || row.driverError?.constraint || row.message || '',
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') {
      const body = response as { message?: unknown };
      if (typeof body.message === 'string') return body.message;
      if (Array.isArray(body.message)) return body.message.join(' ');
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function isPostgresUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  const unique =
    errorCode(error) === '23505' ||
    /duplicate key value violates unique constraint/i.test(errorMessage(error));
  if (!unique) return false;
  if (!constraint) return true;
  return errorConstraint(error).includes(constraint);
}

export function isLibreDeskConnectorAuthError(error: unknown): boolean {
  return /invalid (zalo|facebook) connector credentials/i.test(
    errorMessage(error),
  );
}

export function isLibreDeskInboxMissing(error: unknown): boolean {
  const status = error instanceof HttpException ? error.getStatus() : undefined;
  const message = errorMessage(error);
  return (
    status === 404 ||
    /returned HTTP 404/i.test(message) ||
    /inbox .*not found/i.test(message)
  );
}

export function isCustomerCareInboundAccepted(payload: {
  conversation_uuid?: string;
  duplicate?: boolean;
  stale?: boolean;
  ignored?: number;
}): boolean {
  return (
    Boolean(payload.conversation_uuid) ||
    payload.stale === true ||
    payload.duplicate === true ||
    Number(payload.ignored) > 0
  );
}
