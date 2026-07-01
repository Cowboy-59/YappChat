import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { authauditlog } from "../db/auth-schema";
import { anonymizeIp } from "./crypto";

/**
 * Spec 011 T001 — append-only audit writer. IPs are anonymised before write.
 * Best-effort: a logging failure must never break the auth flow it records.
 */
export type AuthEventType =
  | "login"
  | "logout"
  | "signup"
  | "password_reset"
  | "email_verify"
  | "family_revoke"
  | "role_grant"
  | "force_signout"
  | "session_revoke"
  | "oauth_link"
  | "oauth_unlink"
  | "agent_token_issue"
  | "agent_token_revoke"
  // Spec 018 delta §3/§5 — contacts flood guard + invite hardening.
  | "contact_flood"
  | "contact_unfreeze"
  | "contact_invite_rejected";

export async function writeAudit(params: {
  eventtype: AuthEventType;
  userid?: string | null;
  ip?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(authauditlog).values({
      id: uuidv7(),
      userid: params.userid ?? null,
      eventtype: params.eventtype,
      ip: anonymizeIp(params.ip),
      payload: params.payload ?? null,
    });
  } catch (err) {
    console.error("[auth] audit write failed:", err);
  }
}

/** Extract a best-effort client IP from request headers (proxy-aware). */
export function clientIpFrom(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
