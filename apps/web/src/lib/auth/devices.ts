import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { orgmemberships, sessions } from "../db/auth-schema";
import { writeAudit } from "./audit";
import { onForceSignout } from "./events";
import { AuthError, revokeSessionById } from "./service";

/**
 * Spec 011 T006 — device session registry surface: list the caller's active
 * sessions, let them revoke their own, and let an admin force sign-out a session.
 * The authoritative revoke is server-side (revokeSessionById); the WS
 * `auth.force_signout` event just makes the targeted device drop instantly.
 */

export type ActiveSession = {
  id: string;
  deviceid: string | null;
  ip: string | null;
  useragent: string | null;
  createdat: string;
  lastusedat: string;
  current: boolean;
};

/** The caller's active (non-revoked, unexpired) sessions, most-recently-used first. */
export async function listActiveSessions(
  userid: string,
  currentSessionId: string | null,
): Promise<ActiveSession[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: sessions.id,
      deviceid: sessions.deviceid,
      ip: sessions.ip,
      useragent: sessions.useragent,
      createdat: sessions.createdat,
      lastusedat: sessions.lastusedat,
    })
    .from(sessions)
    .where(and(eq(sessions.userid, userid), isNull(sessions.revokedat), gt(sessions.expiresat, new Date())))
    .orderBy(desc(sessions.lastusedat));
  return rows.map((r) => ({
    ...r,
    createdat: r.createdat.toISOString(),
    lastusedat: r.lastusedat.toISOString(),
    current: r.id === currentSessionId,
  }));
}

/** Revoke one of the caller's OWN sessions (self-service). 404 if not theirs. */
export async function revokeOwnSession(userid: string, sessionid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);
  const [s] = await db
    .select({ userid: sessions.userid })
    .from(sessions)
    .where(eq(sessions.id, sessionid))
    .limit(1);
  if (!s || s.userid !== userid) throw new AuthError("session_not_found", 404);
  await revokeSessionById(sessionid);
  await writeAudit({ eventtype: "session_revoke", userid, payload: { sessionid } });
  // Make the targeted device drop in real time; other devices match their own
  // session id against payload.sessionid and ignore this event.
  await onForceSignout(userid, sessionid);
}

/**
 * Admin force sign-out (FR-013). Authorization: a system admin can revoke any
 * session; an org owner/admin can revoke a session belonging to a user who
 * shares an org they administer. Emits auth.force_signout to the target device.
 */
export async function forceRevokeSession(
  caller: { id: string; issystemadmin: boolean },
  sessionid: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);
  const [s] = await db
    .select({ userid: sessions.userid, deviceid: sessions.deviceid })
    .from(sessions)
    .where(eq(sessions.id, sessionid))
    .limit(1);
  if (!s) throw new AuthError("session_not_found", 404);

  if (!caller.issystemadmin && !(await sharesAdministeredOrg(caller.id, s.userid))) {
    throw new AuthError("forbidden", 403);
  }

  await revokeSessionById(sessionid);
  await writeAudit({
    eventtype: "force_signout",
    userid: s.userid,
    payload: { sessionid, deviceid: s.deviceid, by: caller.id },
  });
  await onForceSignout(s.userid, sessionid);
}

/** True if `callerId` is owner/admin of some org that `targetId` is a member of. */
async function sharesAdministeredOrg(callerId: string, targetId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const adminOrgs = await db
    .select({ orgid: orgmemberships.orgid })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.userid, callerId), inArray(orgmemberships.role, ["owner", "admin"])));
  if (adminOrgs.length === 0) return false;
  const orgIds = adminOrgs.map((o) => o.orgid);
  const [match] = await db
    .select({ orgid: orgmemberships.orgid })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.userid, targetId), inArray(orgmemberships.orgid, orgIds)))
    .limit(1);
  return Boolean(match);
}
