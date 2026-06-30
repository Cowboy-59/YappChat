/**
 * Spec 012 T007 — return-URL allow-list (FR-007, FR-018).
 *
 * The post-login redirect honours `?return=<path>` ONLY if it matches the
 * allow-list:
 *   - the authenticated app surfaces (`/app`, `/communities`, `/messaging`,
 *     `/assistant`, `/studio`) for any authenticated user (spec 068)
 *   - `^/admin(/|$)` additionally, only when the caller has a system flag
 *
 * Everything else (off-domain, protocol-relative `//host`, `javascript:`,
 * `data:`, backslash tricks, encoded variants) is rejected and the caller falls
 * back to the safe default. Pure function so it is unit-testable in isolation.
 */

// Authenticated app surfaces any signed-in user may be returned to (spec 068).
// `invite` lets the invite-accept landing run right after sign-up/in/SSO;
// `members`/`support` are the org + support surfaces.
const USER_PATHS = /^\/(app|communities|presentations|messaging|chats|assistant|studio|invite|members|support)(\/|$)/;
const ADMIN_PATH = /^\/admin(\/|$)/;

export const DEFAULT_USER_PATH = "/app";
export const DEFAULT_ADMIN_PATH = "/admin";

export function isAllowedReturnPath(
  rawReturn: string | null | undefined,
  opts: { isSystemStaff: boolean },
): boolean {
  if (!rawReturn) return false;

  // Decode once so encoded payloads (e.g. %2F%2Fhost) are inspected, not the
  // literal text. Malformed encoding -> reject.
  let value: string;
  try {
    value = decodeURIComponent(rawReturn);
  } catch {
    return false;
  }

  // Must be a single-line, root-relative path.
  if (value.length === 0 || /[\n\r\t]/.test(value)) return false;
  // Reject scheme-bearing / protocol-relative / backslash-smuggled URLs.
  if (!value.startsWith("/")) return false; // must be root-relative
  if (value.startsWith("//") || value.startsWith("/\\")) return false; // protocol-relative
  if (value.includes("\\")) return false; // backslash normalisation tricks
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return false; // e.g. "/javascript:..."
  if (/(javascript|data|vbscript):/i.test(value)) return false;

  if (USER_PATHS.test(value)) return true;
  if (ADMIN_PATH.test(value)) return opts.isSystemStaff;
  return false;
}

/**
 * Resolve the post-login destination: an allow-listed `return`, else the
 * role-appropriate default (/admin for system staff, /app otherwise).
 */
export function resolveReturnPath(
  rawReturn: string | null | undefined,
  opts: { isSystemStaff: boolean },
): string {
  if (isAllowedReturnPath(rawReturn, opts)) {
    return decodeURIComponent(rawReturn as string);
  }
  return opts.isSystemStaff ? DEFAULT_ADMIN_PATH : DEFAULT_USER_PATH;
}
