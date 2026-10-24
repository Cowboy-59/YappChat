/**
 * SPEC-093 — typed refusal for the wxKanban consumer API. The route guard maps it
 * to `{ error: code, ...extra }` with `status` (the C1 error codes in wxKanban
 * SPEC-144 contracts.md).
 */

// [SCOPE 093 / T001] BEGIN — ConsumerError
export class ConsumerError extends Error {
  constructor(
    public code: string,
    public status: number,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "ConsumerError";
  }
}
// [SCOPE 093 / T001] END
