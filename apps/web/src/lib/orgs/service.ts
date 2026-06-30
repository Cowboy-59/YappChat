import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { orginvitations, orgmemberships, orgs, users } from "../db/auth-schema";
import { generateToken, hashToken } from "../auth/crypto";
import { sendEmail } from "../auth/mailer";
import { getSiteUrl } from "../site";
import { EngineError } from "../engine/errors";

/**
 * Company (org) member management — spec 011 T005 remainder.
 * Invite by email (token + accept), list, change role, remove. Seat limits and
 * last-owner protection enforced here. Reuses the auth token primitives + mailer.
 */

export type OrgMember = {
  userid: string;
  email: string;
  displayname: string;
  role: "owner" | "admin" | "member";
};

export type PendingInvite = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expiresat: string;
};

const INVITE_TTL_MS = 7 * 24 * 3_600_000; // 7 days

async function ownerCount(orgid: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.role, "owner")));
  return r?.n ?? 0;
}

async function memberCount(orgid: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orgmemberships)
    .where(eq(orgmemberships.orgid, orgid));
  return r?.n ?? 0;
}

export async function listOrgMembers(orgid: string): Promise<OrgMember[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ userid: users.id, email: users.email, displayname: users.displayname, role: orgmemberships.role })
    .from(orgmemberships)
    .innerJoin(users, eq(orgmemberships.userid, users.id))
    .where(eq(orgmemberships.orgid, orgid));
  return rows;
}

export async function listPendingInvites(orgid: string): Promise<PendingInvite[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: orginvitations.id, email: orginvitations.email, role: orginvitations.role, expiresat: orginvitations.expiresat })
    .from(orginvitations)
    .where(and(eq(orginvitations.orgid, orgid), isNull(orginvitations.consumedat), gt(orginvitations.expiresat, new Date())));
  return rows.map((r) => ({ ...r, expiresat: r.expiresat.toISOString() }));
}

/** Invite a colleague by email. If they already have an account they can accept
 *  immediately; either way an email with the accept link is sent. */
export async function inviteOrgMember(input: {
  orgid: string;
  email: string;
  role: "admin" | "member";
  invitedby: string;
}): Promise<{ token: string; expiresat: Date }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new EngineError("invalid_email", 400);

  const [org] = await db.select({ seatlimit: orgs.seatlimit }).from(orgs).where(eq(orgs.id, input.orgid)).limit(1);
  if (!org) throw new EngineError("org_not_found", 404);

  // Already a member?
  const existing = await db
    .select({ id: orgmemberships.id })
    .from(orgmemberships)
    .innerJoin(users, eq(orgmemberships.userid, users.id))
    .where(and(eq(orgmemberships.orgid, input.orgid), eq(users.email, email)))
    .limit(1);
  if (existing.length) throw new EngineError("already_member", 409);

  // Seat limit counts current members + still-valid pending invites.
  if (org.seatlimit != null) {
    const pending = await listPendingInvites(input.orgid);
    if ((await memberCount(input.orgid)) + pending.length >= org.seatlimit) {
      throw new EngineError("seat_limit_reached", 409);
    }
  }

  const token = generateToken();
  const expiresat = new Date(Date.now() + INVITE_TTL_MS);
  await db.insert(orginvitations).values({
    id: uuidv7(),
    orgid: input.orgid,
    email,
    role: input.role,
    tokenhash: hashToken(token),
    invitedby: input.invitedby,
    expiresat,
  });
  await sendEmail({
    to: email,
    subject: "You're invited to a YappChatt workspace",
    body: "You've been invited to join a workspace. Sign in (or create an account with this email) and open the link below to accept. It expires in 7 days.",
    actionUrl: `${getSiteUrl()}/invite/${token}`,
  });
  return { token, expiresat };
}

/** Accept an invitation as the logged-in user (whose email must match the invite). */
export async function acceptOrgInvitation(token: string, userid: string, userEmail: string): Promise<{ orgid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [inv] = await db
    .select()
    .from(orginvitations)
    .where(and(eq(orginvitations.tokenhash, hashToken(token)), isNull(orginvitations.consumedat), gt(orginvitations.expiresat, new Date())))
    .limit(1);
  if (!inv) throw new EngineError("invite_invalid_or_expired", 404);
  if (inv.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
    throw new EngineError("invite_email_mismatch", 403, "this invite was sent to a different email");
  }

  // Re-check seat limit at accept time.
  const [org] = await db.select({ seatlimit: orgs.seatlimit }).from(orgs).where(eq(orgs.id, inv.orgid)).limit(1);
  if (org?.seatlimit != null && (await memberCount(inv.orgid)) >= org.seatlimit) {
    throw new EngineError("seat_limit_reached", 409);
  }

  await db
    .insert(orgmemberships)
    .values({ id: uuidv7(), userid, orgid: inv.orgid, role: inv.role })
    .onConflictDoNothing();
  await db.update(orginvitations).set({ consumedat: new Date() }).where(eq(orginvitations.id, inv.id));
  return { orgid: inv.orgid };
}

/**
 * Read-only look at an invite by token (does NOT consume it) — used by the invite
 * landing page to route a recipient to sign-up (new) vs sign-in (existing account).
 */
export async function getInvitePreview(
  token: string,
): Promise<{ valid: boolean; email: string | null; orgName: string | null; userExists: boolean }> {
  const db = getDb();
  if (!db) return { valid: false, email: null, orgName: null, userExists: false };
  const [inv] = await db
    .select({ email: orginvitations.email, orgid: orginvitations.orgid })
    .from(orginvitations)
    .where(
      and(eq(orginvitations.tokenhash, hashToken(token)), isNull(orginvitations.consumedat), gt(orginvitations.expiresat, new Date())),
    )
    .limit(1);
  if (!inv) return { valid: false, email: null, orgName: null, userExists: false };
  const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, inv.orgid)).limit(1);
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, inv.email.toLowerCase())).limit(1);
  return { valid: true, email: inv.email, orgName: org?.name ?? null, userExists: Boolean(u) };
}

export async function revokeInvite(orgid: string, inviteid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await db.delete(orginvitations).where(and(eq(orginvitations.id, inviteid), eq(orginvitations.orgid, orgid)));
}

/** Resend a pending invite: rotate the token (old link dies), extend the expiry,
 *  and re-email the new link. */
export async function resendOrgInvitation(orgid: string, inviteid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [inv] = await db
    .select()
    .from(orginvitations)
    .where(and(eq(orginvitations.id, inviteid), eq(orginvitations.orgid, orgid)))
    .limit(1);
  if (!inv) throw new EngineError("invite_not_found", 404);
  if (inv.consumedat) throw new EngineError("invite_already_accepted", 409);

  const token = generateToken();
  const expiresat = new Date(Date.now() + INVITE_TTL_MS);
  await db.update(orginvitations).set({ tokenhash: hashToken(token), expiresat }).where(eq(orginvitations.id, inviteid));
  await sendEmail({
    to: inv.email,
    subject: "Your YappChatt workspace invitation",
    body: "Here's your workspace invitation again. Sign in (or create an account with this email) and open the link below to accept. It expires in 7 days.",
    actionUrl: `${getSiteUrl()}/invite/${token}`,
  });
}

export async function removeOrgMember(orgid: string, targetuserid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [member] = await db
    .select({ role: orgmemberships.role })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, targetuserid)))
    .limit(1);
  if (!member) throw new EngineError("member_not_found", 404);
  if (member.role === "owner" && (await ownerCount(orgid)) <= 1) {
    throw new EngineError("last_owner", 409, "cannot remove the last owner");
  }
  await db.delete(orgmemberships).where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, targetuserid)));
}

export async function setOrgMemberRole(orgid: string, targetuserid: string, role: "owner" | "admin" | "member"): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [member] = await db
    .select({ role: orgmemberships.role })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, targetuserid)))
    .limit(1);
  if (!member) throw new EngineError("member_not_found", 404);
  // Don't allow demoting the last owner.
  if (member.role === "owner" && role !== "owner" && (await ownerCount(orgid)) <= 1) {
    throw new EngineError("last_owner", 409, "promote another owner first");
  }
  await db
    .update(orgmemberships)
    .set({ role })
    .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, targetuserid)));
}
