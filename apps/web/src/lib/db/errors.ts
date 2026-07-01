/**
 * Postgres error helpers. postgres-js surfaces the SQLSTATE on `.code` (sometimes
 * nested on `.cause`), which drizzle rethrows. `23505` = unique_violation — used to
 * turn a partial-unique-index race into an idempotent no-op rather than a 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  return e.code === "23505" || e.cause?.code === "23505";
}
