import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Spec 003 — short-lived WS handshake token (cross-domain auth, no cookie).
 *
 * The app mints a signed token for the logged-in user (GET /api/ws/token); the
 * browser passes it as `?token=` when opening the socket; the engine verifies it.
 * Signed (HMAC-SHA256) with WS_INTERNAL_SECRET — the same shared secret the app
 * already uses for the /publish seam — so the engine validates statelessly (no DB
 * round-trip). Server/engine only: never imported by browser code, so the secret
 * never ships to the client.
 */
const DEFAULT_TTL_MS = 60_000; // enough to open the socket; the socket lives on after

// Read lazily, NOT at module load: the WS engine populates process.env from
// .env.local AFTER importing this module, so a module-level const would capture
// the fallback and mismatch the app's signature.
function secret(): string {
  return process.env.WS_INTERNAL_SECRET ?? "dev-internal-secret";
}

export function mintWsToken(userid: string, ttlMs = DEFAULT_TTL_MS): string {
  const body = Buffer.from(JSON.stringify({ uid: userid, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Returns the userid if the token is well-formed, correctly signed, and unexpired. */
export function verifyWsToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, "base64url").toString()) as { uid?: unknown; exp?: unknown };
    if (typeof uid !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}
