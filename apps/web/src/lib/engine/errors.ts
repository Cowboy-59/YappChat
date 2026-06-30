/** Spec 001 — typed engine error mapped to HTTP by the route handlers. */
export class EngineError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(code);
    this.name = "EngineError";
  }
}
