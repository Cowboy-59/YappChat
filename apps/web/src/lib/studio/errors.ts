/** Spec 004 — typed studio error mapped to HTTP by the route handlers. */
export class StudioError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(code);
    this.name = "StudioError";
  }
}
