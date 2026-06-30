import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";

/**
 * Spec 011 T001 — cryptographic primitives.
 *
 * Passwords: argon2id, m_cost 64MB / t_cost 3 / parallelism 1 (env-tunable).
 * Tokens: opaque random bytes; only their SHA-256 hash is ever stored. No JWTs.
 */

const ARGON2_MEMORY_KIB = Number(process.env.AUTH_ARGON2_MEMORY_KIB ?? 65536); // 64 MB
const ARGON2_ITERATIONS = Number(process.env.AUTH_ARGON2_ITERATIONS ?? 3);

export async function hashPassword(password: string): Promise<string> {
  // @node-rs/argon2 defaults to the Argon2id variant.
  return hash(password, {
    memoryCost: ARGON2_MEMORY_KIB,
    timeCost: ARGON2_ITERATIONS,
    parallelism: 1,
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Opaque token: 32 random bytes, base64url. Plaintext returned to the caller. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest — what we persist for sessions/refresh/verify/reset tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Anonymise an IP before it touches the audit log (FR / SOC2): zero the last
 * v4 octet, or the last 80 bits of a v6 address. Returns null for unknown.
 */
export function anonymizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const clean = ip.trim();
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    return null;
  }
  if (clean.includes(":")) {
    // Keep the first 3 hextets (48 bits) — zero the remaining 80.
    const hextets = clean.split(":").filter(Boolean);
    return `${hextets.slice(0, 3).join(":")}::`;
  }
  return null;
}
