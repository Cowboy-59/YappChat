import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { orgmemberships, orgs, sessions, users } from "../db/auth-schema";
import { ACTIVE_ORG_COOKIE } from "./constants";
import { hashToken } from "./crypto";
import { readSessionCookie } from "./cookies";
import { isSystemStaff, type OrgSummary, type SessionUser, type SystemFlag } from "./shared";

/**
 * Spec 011 T001 — server-only session resolution + requireAuth.
 *
 * Validation is a single indexed lookup on sessions(sessiontokenhash) joined to
 * users (sub-5ms target), filtered to non-revoked + unexpired sessions. No JWTs.
 *
 * Client-safe types + isSystemStaff live in ./shared and are re-exported here so
 * existing server imports keep working.
 */
export { isSystemStaff };
export type { OrgSummary, SessionUser, SystemFlag };

/** Resolve the current session user from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionCookie();
  if (!token) return null;

  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayname: users.displayname,
      kind: users.kind,
      issystemadmin: users.issystemadmin,
      isbillingadmin: users.isbillingadmin,
      issupport: users.issupport,
      emailverifiedat: users.emailverifiedat,
      bio: users.bio,
      avatarurl: users.avatarurl,
      preferredlanguage: users.preferredlanguage,
      autotranslate: users.autotranslate,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userid, users.id))
    .where(
      and(
        eq(sessions.sessiontokenhash, hashToken(token)),
        isNull(sessions.revokedat),
        gt(sessions.expiresat, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    displayname: row.displayname,
    kind: row.kind,
    issystemadmin: row.issystemadmin,
    isbillingadmin: row.isbillingadmin,
    issupport: row.issupport,
    emailverified: row.emailverifiedat != null,
    bio: row.bio,
    avatarurl: row.avatarurl,
    preferredlanguage: row.preferredlanguage,
    autotranslate: row.autotranslate,
  };
}

/** The id of the caller's current (non-revoked, unexpired) session row, or null.
 *  Used to flag "this device" in the session list and to target force-signout. */
export async function getCurrentSessionId(): Promise<string | null> {
  const token = await readSessionCookie();
  if (!token) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.sessiontokenhash, hashToken(token)),
        isNull(sessions.revokedat),
        gt(sessions.expiresat, new Date()),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/** Every org the user belongs to (for the switcher), most-recent membership first. */
export async function listUserOrgs(userid: string): Promise<OrgSummary[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select({ id: orgs.id, name: orgs.name, role: orgmemberships.role, plantype: orgs.plantype })
    .from(orgmemberships)
    .innerJoin(orgs, eq(orgmemberships.orgid, orgs.id))
    .where(eq(orgmemberships.userid, userid))
    .orderBy(orgmemberships.createdat);
}

/**
 * The caller's active org. Honors the `yc_active_org` cookie when it names an org
 * the user actually belongs to (the multi-org switcher); otherwise falls back to
 * their first membership. Returns null when the user has no org.
 */
export async function getActiveOrg(userid: string): Promise<OrgSummary | null> {
  const orgsList = await listUserOrgs(userid);
  if (orgsList.length === 0) return null;
  let preferred: string | undefined;
  try {
    preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  } catch {
    /* outside a request scope — fall back to first */
  }
  return orgsList.find((o) => o.id === preferred) ?? orgsList[0];
}

export type AuthSuccess = { ok: true; user: SessionUser; org: OrgSummary | null };
export type AuthFailure = { ok: false; status: 401 | 403; error: string };
export type AuthResult = AuthSuccess | AuthFailure;

/**
 * The single auth gate for route handlers (bespoke per-route checks are a hard
 * violation). Returns a discriminated result; callers do:
 *   const auth = await requireAuth({ systemFlag: "issystemadmin" });
 *   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
 */
export async function requireAuth(opts?: {
  systemFlag?: SystemFlag;
  orgRole?: "owner" | "admin" | "member";
}): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  if (opts?.systemFlag && !user[opts.systemFlag]) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const org = await getActiveOrg(user.id);

  if (opts?.orgRole) {
    const rank = { member: 0, admin: 1, owner: 2 } as const;
    if (!org || rank[org.role] < rank[opts.orgRole]) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  return { ok: true, user, org };
}
