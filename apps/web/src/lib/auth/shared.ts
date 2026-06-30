/**
 * Spec 011 — client-safe auth types + pure helpers.
 *
 * This module has NO server-only imports (no next/headers, db, or argon2), so it
 * is safe to import from Client Components. Server-only session logic lives in
 * session.ts, which re-exports these.
 */

export type SessionUser = {
  id: string;
  email: string;
  displayname: string;
  kind: "human" | "agent";
  issystemadmin: boolean;
  isbillingadmin: boolean;
  issupport: boolean;
  emailverified: boolean;
  // Spec 068 — account profile fields (nullable until the user sets them).
  bio: string | null;
  avatarurl: string | null;
  preferredlanguage: string | null;
};

export type OrgSummary = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  plantype: "individual" | "corporate";
};

export type SystemFlag = "issystemadmin" | "isbillingadmin" | "issupport";

/** True when the user holds any system-staff flag (-> /admin redirect target). */
export function isSystemStaff(
  user: Pick<SessionUser, "issystemadmin" | "isbillingadmin" | "issupport">,
): boolean {
  return user.issystemadmin || user.isbillingadmin || user.issupport;
}
