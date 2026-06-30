/** Spec 002 — typed PA error mapped to HTTP by the route handlers. */
export class PaError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(code);
    this.name = "PaError";
  }
}
