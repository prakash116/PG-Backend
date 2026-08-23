/** Reading Prisma errors precisely enough to turn them into useful HTTP responses. */
import { Prisma } from '../generated/prisma/client';

/** Postgres' SQLSTATE for a unique violation, if the shapes below ever change again. */
const UNIQUE_VIOLATION_SQLSTATE = '23505';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Which columns a unique constraint covered.
 *
 * Prisma 7 with a driver adapter no longer sets `meta.target`; the field list
 * moved inside the adapter's own error:
 *
 *   meta.driverAdapterError.cause.constraint.fields = ['email']
 *
 * Code written against `meta.target` therefore stops matching without failing —
 * the branch simply never runs, and a 409 quietly becomes a 500. Both shapes
 * are read here, plus the constraint name from the original Postgres message as
 * a last resort, so this keeps working whichever one Prisma reports.
 */
export function uniqueConstraintFields(error: unknown): string[] {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return [];
  }

  const meta = asRecord(error.meta);
  if (!meta) return [];

  // Prisma 7 + driver adapter.
  const cause = asRecord(asRecord(meta.driverAdapterError)?.cause);
  const constraint = asRecord(cause?.constraint);
  const fields = constraint?.fields;

  if (Array.isArray(fields) && fields.length > 0) {
    return fields.map(String);
  }

  // Prisma 6 and earlier, and the query-engine path.
  const target = meta.target;

  if (Array.isArray(target) && target.length > 0) {
    return target.map(String);
  }

  if (typeof target === 'string' && target) {
    return [target];
  }

  // Last resort: the raw Postgres message names the index, e.g. "User_email_key".
  if (cause?.originalCode === UNIQUE_VIOLATION_SQLSTATE) {
    const message = String(cause.originalMessage ?? '');
    const index = /unique constraint "([^"]+)"/.exec(message)?.[1];

    if (index) return [index];
  }

  return [];
}

/**
 * P2028: an interactive transaction ran past its budget.
 *
 * Almost always a slow link rather than a slow query — the database is in
 * ap-southeast-2 and a round trip costs ~400 ms, so a handful of sequential
 * statements is enough. It says nothing useful to the person saving, so the
 * caller should turn it into "that took too long, try again" rather than a 500.
 */
export function isTransactionTimeout(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2028'
  );
}

/** True when `error` is a unique violation involving `field`. */
export function isUniqueConstraintOn(error: unknown, field: string): boolean {
  const needle = field.toLowerCase();

  return uniqueConstraintFields(error).some((name) =>
    name.toLowerCase().includes(needle),
  );
}
