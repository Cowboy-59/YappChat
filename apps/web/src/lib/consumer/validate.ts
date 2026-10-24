import { ConsumerError } from "./errors";

/** SPEC-093 — input checks shared by the consumer services. */

// [SCOPE 093 / T001] BEGIN — Consumer input validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MAX_NAME = 200;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** A body id: malformed → 400 invalid_request (named field). */
export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new ConsumerError("invalid_request", 400, { field });
  return value.toLowerCase();
}

export function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) throw new ConsumerError("invalid_email", 400);
  return email;
}

export function requireName(value: unknown, field: string): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > MAX_NAME) throw new ConsumerError("invalid_request", 400, { field });
  return name;
}

/** `seatlimit`: null (unlimited) or a whole number of at least 1. Must be present. */
export function requireSeatlimit(body: Record<string, unknown>): number | null {
  if (!("seatlimit" in body)) throw new ConsumerError("invalid_request", 400, { field: "seatlimit" });
  const v = body.seatlimit;
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 1_000_000) {
    throw new ConsumerError("invalid_request", 400, { field: "seatlimit" });
  }
  return v;
}
// [SCOPE 093 / T001] END
