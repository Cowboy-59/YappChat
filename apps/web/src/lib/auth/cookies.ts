import { cookies, headers } from "next/headers";
import {
  REFRESH_COOKIE,
  REFRESH_TTL_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./constants";

/**
 * Spec 011 T001 — auth cookies.
 * httpOnly + SameSite=Lax + Path=/; Secure in production. The cookie carries the
 * opaque token plaintext; only its SHA-256 hash is stored server-side.
 */
const secure = process.env.NODE_ENV === "production";

export async function setAuthCookies(
  sessionToken: string,
  refreshToken: string,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(REFRESH_TTL_MS / 1000),
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolve the opaque session token for the request, from EITHER an
 * `Authorization: Bearer <token>` header (native mobile clients — spec 008) OR the
 * `yc_session` cookie (web). The header wins when present. The token is the same
 * opaque value in both transports; server-side we still look up only its hash.
 */
export async function readSessionToken(): Promise<string | null> {
  try {
    const auth = (await headers()).get("authorization");
    if (auth && /^Bearer\s+/i.test(auth)) {
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token) return token;
    }
  } catch {
    /* outside a request scope (e.g. build) — fall back to the cookie */
  }
  return readSessionCookie();
}

export async function readRefreshCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}
