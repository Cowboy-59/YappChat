import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import {
  communities,
  communityauditlog,
  communityinvites,
  communitymembers,
  joinrequests,
  spaces,
  type CommunityRole,
  type JoinPolicy,
  type JoinRequestRow,
} from "../db/communities-schema";
import { conversationmembers } from "../db/engine-schema";
import { orgmemberships } from "../db/auth-schema";
import { hashToken } from "../auth/crypto";
import { EngineError } from "../engine/errors";
import { addConversationMember } from "../engine/service";
import { isStrictlyStricterJoin, ROLE_RANK } from "./policy";

/**
 * Spec 017 T002 — join / approval / moderation. All state-changing actions write
 * an append-only `communityauditlog` row. Joining a community syncs the user into
 * every space's `conversationmembers` (spec 001 T009) so they can participate.
 */

export type JoinOutcome = "join" | "request" | "deny";

/** Pure decision: given the community policy + whether a valid invite was supplied. */
export function decideJoinOutcome(policy: JoinPolicy, hasValidInvite: boolean): JoinOutcome {
  if (hasValidInvite) return "join"; // a valid invite bypasses approval/invite gating
  if (policy === "open") return "join";
  if (policy === "approval") return "request";
  return "deny"; // invite-only with no invite
}

type Db = NonNullable<ReturnType<typeof getDb>>;

async function audit(db: Db, communityid: string, actorid: string, eventtype: string, payload?: unknown): Promise<void> {
  await db.insert(communityauditlog).values({ id: uuidv7(), communityid, actorid, eventtype, payload: payload ?? null });
}

async function ownerCount(db: Db, communityid: string): Promise<number> {
  const rows = await db
    .select({ id: communitymembers.id })
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.role, "owner")));
  return rows.length;
}

/** The org of the community's owner — "the corp" for corp-only spaces (or null). */
async function communityOrgId(db: Db, communityid: string): Promise<string | null> {
  const [c] = await db.select({ ownerid: communities.ownerid }).from(communities).where(eq(communities.id, communityid)).limit(1);
  if (!c) return null;
  const [m] = await db.select({ orgid: orgmemberships.orgid }).from(orgmemberships).where(eq(orgmemberships.userid, c.ownerid)).limit(1);
  return m?.orgid ?? null;
}

async function isOrgMember(db: Db, orgid: string, userid: string): Promise<boolean> {
  const [m] = await db
    .select({ id: orgmemberships.id })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, userid)))
    .limit(1);
  return Boolean(m);
}

/**
 * Auto-join a member into a community's spaces — but ONLY the ones they qualify
 * for. Skipped: `adminonly` (owners/mods only), `corponly` unless the member is in
 * the owner's org, and any space STRICTLY stricter than the community (gated, e.g.
 * a Support space). This is what makes "the lowest level decides who gets in" real.
 */
async function syncMemberToSpaces(db: Db, communityid: string, userid: string): Promise<void> {
  const [c] = await db.select({ joinpolicy: communities.joinpolicy }).from(communities).where(eq(communities.id, communityid)).limit(1);
  if (!c) return;
  const orgid = await communityOrgId(db, communityid);
  const sp = await db
    .select({ conversationid: spaces.conversationid, joinpolicy: spaces.joinpolicy, adminonly: spaces.adminonly, corponly: spaces.corponly })
    .from(spaces)
    .where(eq(spaces.communityid, communityid));
  for (const s of sp) {
    if (s.adminonly) continue;
    if (s.corponly) {
      if (orgid && (await isOrgMember(db, orgid, userid))) await addConversationMember({ conversationid: s.conversationid, userid });
      continue;
    }
    if (s.joinpolicy && isStrictlyStricterJoin(c.joinpolicy, s.joinpolicy)) continue;
    await addConversationMember({ conversationid: s.conversationid, userid });
  }
}

/** Add only the community's owners + moderators to a space conversation (used for
 *  admin/gated spaces, where regular members must not be auto-included). */
export async function syncStaffToSpace(communityid: string, conversationid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const staff = await db
    .select({ userid: communitymembers.userid })
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), inArray(communitymembers.role, ["owner", "moderator"])));
  for (const s of staff) await addConversationMember({ conversationid, userid: s.userid });
}

/** Seed a corp-only space: owners/mods + community members who are in the owner's org. */
export async function syncCorpToSpace(communityid: string, conversationid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const orgid = await communityOrgId(db, communityid);
  const members = await db
    .select({ userid: communitymembers.userid, role: communitymembers.role })
    .from(communitymembers)
    .where(eq(communitymembers.communityid, communityid));
  for (const m of members) {
    if (m.role === "owner" || m.role === "moderator") await addConversationMember({ conversationid, userid: m.userid });
    else if (orgid && (await isOrgMember(db, orgid, m.userid))) await addConversationMember({ conversationid, userid: m.userid });
  }
}

async function addMember(db: Db, communityid: string, userid: string, role: CommunityRole = "member"): Promise<void> {
  await db.insert(communitymembers).values({ id: uuidv7(), communityid, userid, role }).onConflictDoNothing();
  await syncMemberToSpaces(db, communityid, userid);
}

async function isMember(db: Db, communityid: string, userid: string): Promise<boolean> {
  const [m] = await db
    .select({ id: communitymembers.id })
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, userid)))
    .limit(1);
  return Boolean(m);
}

/**
 * wxKanban Cockpit community-help consumer seam. GUARANTEE that a user is a member
 * of a community AND of one specific space's conversation, independent of the
 * community/space join policy — this deliberately does NOT go through
 * `joinCommunity` (which would gate an approval/invite-only community). It inserts
 * the `communitymembers` row (via the shared low-level `addMember`, which also
 * syncs the non-strict spaces) and then admits the user to the TARGET space's
 * conversation UNCONDITIONALLY, overriding any adminonly/corponly/stricter policy —
 * the same override `redeemInvite` uses. Idempotent. Returns the space's
 * conversationid so the caller can route the user straight into it.
 */
export async function ensureCommunityAndSpaceMember(
  communityid: string,
  spaceid: string,
  userid: string,
): Promise<{ conversationid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const [community] = await db.select({ id: communities.id }).from(communities).where(eq(communities.id, communityid)).limit(1);
  if (!community) throw new EngineError("community_not_found", 404);

  const [space] = await db
    .select({ conversationid: spaces.conversationid })
    .from(spaces)
    .where(and(eq(spaces.id, spaceid), eq(spaces.communityid, communityid)))
    .limit(1);
  if (!space) throw new EngineError("space_not_found", 404);

  await addMember(db, communityid, userid, "member");
  await addConversationMember({ conversationid: space.conversationid, userid });
  await audit(db, communityid, userid, "member_joined", { via: "wxkanban_consumer", spaceid });
  return { conversationid: space.conversationid };
}

export type JoinResult = { status: "member" | "pending"; already?: boolean };

/** Join (or request to join, or be rejected) per the effective community policy. */
export async function joinCommunity(
  communityid: string,
  userid: string,
  opts?: { inviteToken?: string; message?: string },
): Promise<JoinResult> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const [community] = await db.select().from(communities).where(eq(communities.id, communityid)).limit(1);
  if (!community) throw new EngineError("community_not_found", 404);

  if (await isMember(db, communityid, userid)) return { status: "member", already: true };

  // Validate an invite if one was supplied (must match this community, be unused
  // and unexpired). Select the fields we check in one query.
  let invite: { id: string } | undefined;
  if (opts?.inviteToken) {
    const [row] = await db
      .select({ id: communityinvites.id, usedat: communityinvites.usedat, expiresat: communityinvites.expiresat })
      .from(communityinvites)
      .where(and(eq(communityinvites.communityid, communityid), eq(communityinvites.tokenhash, hashToken(opts.inviteToken))))
      .limit(1);
    if (row && row.usedat == null && row.expiresat > new Date()) invite = { id: row.id };
  }

  const outcome = decideJoinOutcome(community.joinpolicy, Boolean(invite));

  if (outcome === "deny") throw new EngineError("invite_required", 403, "this community is invite-only");

  if (outcome === "join") {
    await addMember(db, communityid, userid, "member");
    if (invite) await db.update(communityinvites).set({ usedat: new Date() }).where(eq(communityinvites.id, invite.id));
    await audit(db, communityid, userid, "member_joined", { via: invite ? "invite" : "open" });
    return { status: "member" };
  }

  // approval → create a pending request (one active request per user).
  const [pending] = await db
    .select({ id: joinrequests.id })
    .from(joinrequests)
    .where(and(eq(joinrequests.communityid, communityid), eq(joinrequests.userid, userid), eq(joinrequests.status, "pending")))
    .limit(1);
  if (pending) return { status: "pending", already: true };

  await db.insert(joinrequests).values({ id: uuidv7(), communityid, userid, message: opts?.message ?? null });
  await audit(db, communityid, userid, "join_requested", { message: opts?.message ?? null });
  return { status: "pending" };
}

/** Create a single-use, expiring invite. Returns the plaintext token ONCE. */
export async function createInvite(
  communityid: string,
  createdby: string,
  ttlHours = 72,
): Promise<{ token: string; expiresat: Date }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const token = randomBytes(24).toString("base64url");
  const expiresat = new Date(Date.now() + ttlHours * 3_600_000);
  await db.insert(communityinvites).values({ id: uuidv7(), communityid, tokenhash: hashToken(token), createdby, expiresat });
  await audit(db, communityid, createdby, "invite_created", { expiresat: expiresat.toISOString() });
  return { token, expiresat };
}

/**
 * Spec 017 FR-020 — create a single-use, expiring PER-SPACE invite. Verifies the
 * space belongs to the community; returns the plaintext token ONCE. Redeeming it
 * admits the recipient directly into this space, overriding its strict policy.
 */
export async function createSpaceInvite(
  communityid: string,
  spaceid: string,
  createdby: string,
  ttlHours = 72,
): Promise<{ token: string; expiresat: Date }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.id, spaceid), eq(spaces.communityid, communityid)))
    .limit(1);
  if (!space) throw new EngineError("space_not_found", 404);
  const token = randomBytes(24).toString("base64url");
  const expiresat = new Date(Date.now() + ttlHours * 3_600_000);
  await db.insert(communityinvites).values({ id: uuidv7(), communityid, spaceid, tokenhash: hashToken(token), createdby, expiresat });
  await audit(db, communityid, createdby, "space_invite_created", { spaceid, expiresat: expiresat.toISOString() });
  return { token, expiresat };
}

export type InvitePreview = {
  kind: "community" | "space";
  communityid: string;
  communityname: string;
  spaceid: string | null;
  spacename: string | null;
  expiresat: Date;
  valid: boolean; // unused && unexpired
};

/**
 * Spec 017 FR-020 — token-first preview. Resolves the community + (optional) space
 * name and validity WITHOUT consuming the invite. Returns null for an unknown
 * token (do not leak whether a hash exists). Names are returned even when invalid
 * so the landing page can say "this invite has expired / was already used".
 */
export async function resolveInvite(token: string): Promise<InvitePreview | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      communityid: communityinvites.communityid,
      spaceid: communityinvites.spaceid,
      usedat: communityinvites.usedat,
      expiresat: communityinvites.expiresat,
      communityname: communities.name,
      spacename: spaces.name,
    })
    .from(communityinvites)
    .innerJoin(communities, eq(communities.id, communityinvites.communityid))
    .leftJoin(spaces, eq(spaces.id, communityinvites.spaceid))
    .where(eq(communityinvites.tokenhash, hashToken(token)))
    .limit(1);
  if (!row) return null;
  return {
    kind: row.spaceid ? "space" : "community",
    communityid: row.communityid,
    communityname: row.communityname,
    spaceid: row.spaceid,
    spacename: row.spacename ?? null,
    expiresat: row.expiresat,
    valid: row.usedat == null && row.expiresat > new Date(),
  };
}

export type RedeemResult = {
  communityid: string;
  communityslug: string;
  spaceid: string | null;
  conversationid: string | null; // the space conversation to route into, if any
};

/**
 * Spec 017 FR-020 — consume an invite. Single-use + concurrency-safe (a guarded
 * `WHERE usedat IS NULL` update, so only the first redeemer wins). Joins the
 * community if needed (silently, as `member`), then for a space invite adds the
 * user to that space's conversation UNCONDITIONALLY — overriding the space's
 * adminonly/corponly/stricter policy. The invite is the grant.
 */
export async function redeemInvite(token: string, userid: string): Promise<RedeemResult> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [invite] = await db
    .select({
      id: communityinvites.id,
      communityid: communityinvites.communityid,
      spaceid: communityinvites.spaceid,
      usedat: communityinvites.usedat,
      expiresat: communityinvites.expiresat,
    })
    .from(communityinvites)
    .where(eq(communityinvites.tokenhash, hashToken(token)))
    .limit(1);
  if (!invite) throw new EngineError("invalid_invite", 404);
  if (invite.usedat != null) throw new EngineError("invite_used", 409);
  if (invite.expiresat <= new Date()) throw new EngineError("invite_expired", 410);

  const [community] = await db
    .select({ slug: communities.slug })
    .from(communities)
    .where(eq(communities.id, invite.communityid))
    .limit(1);
  if (!community) throw new EngineError("community_not_found", 404);

  // Resolve the invited space's conversation up front (before consuming).
  let conversationid: string | null = null;
  if (invite.spaceid) {
    const [space] = await db
      .select({ conversationid: spaces.conversationid })
      .from(spaces)
      .where(eq(spaces.id, invite.spaceid))
      .limit(1);
    if (!space) throw new EngineError("space_not_found", 404);
    conversationid = space.conversationid;
  }

  // Consume FIRST — guarded so a concurrent double-redeem can't both win.
  const consumed = await db
    .update(communityinvites)
    .set({ usedat: new Date() })
    .where(and(eq(communityinvites.id, invite.id), isNull(communityinvites.usedat)))
    .returning({ id: communityinvites.id });
  if (consumed.length === 0) throw new EngineError("invite_used", 409);

  // Join the community if needed (this syncs the normal, non-strict spaces).
  if (!(await isMember(db, invite.communityid, userid))) {
    await addMember(db, invite.communityid, userid, "member");
  }
  // Admit to the invited space directly — the override (idempotent if already in).
  if (conversationid) await addConversationMember({ conversationid, userid });

  await audit(db, invite.communityid, userid, invite.spaceid ? "space_invite_redeemed" : "invite_redeemed", {
    spaceid: invite.spaceid,
  });
  return { communityid: invite.communityid, communityslug: community.slug, spaceid: invite.spaceid, conversationid };
}

export async function listJoinRequests(communityid: string, status: "pending" | "approved" | "denied" = "pending"): Promise<JoinRequestRow[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(joinrequests)
    .where(and(eq(joinrequests.communityid, communityid), eq(joinrequests.status, status)))
    .orderBy(desc(joinrequests.requestedat));
}

export async function decideJoinRequest(
  communityid: string,
  requestid: string,
  decidedby: string,
  approve: boolean,
): Promise<JoinRequestRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [reqRow] = await db
    .select()
    .from(joinrequests)
    .where(and(eq(joinrequests.id, requestid), eq(joinrequests.communityid, communityid)))
    .limit(1);
  if (!reqRow) throw new EngineError("request_not_found", 404);
  if (reqRow.status !== "pending") throw new EngineError("request_already_decided", 409);

  if (approve) {
    await addMember(db, communityid, reqRow.userid, "member");
    await audit(db, communityid, decidedby, "join_approved", { userid: reqRow.userid });
  } else {
    await audit(db, communityid, decidedby, "join_denied", { userid: reqRow.userid });
  }
  await db
    .update(joinrequests)
    .set({ status: approve ? "approved" : "denied", decidedby, decidedat: new Date() })
    .where(eq(joinrequests.id, requestid));
  const [updated] = await db.select().from(joinrequests).where(eq(joinrequests.id, requestid)).limit(1);
  return updated;
}

export async function setMemberRole(
  communityid: string,
  targetuserid: string,
  role: CommunityRole,
  actorid: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [member] = await db
    .select()
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, targetuserid)))
    .limit(1);
  if (!member) throw new EngineError("member_not_found", 404);

  // Last-owner protection: never demote the final owner.
  if (member.role === "owner" && ROLE_RANK[role] < ROLE_RANK.owner && (await ownerCount(db, communityid)) <= 1) {
    throw new EngineError("last_owner", 409, "cannot demote the last owner");
  }
  await db
    .update(communitymembers)
    .set({ role })
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, targetuserid)));

  // Admin spaces are owners/mods-only: promotions grant access, demotions revoke it.
  const adminSpaces = await db
    .select({ conversationid: spaces.conversationid })
    .from(spaces)
    .where(and(eq(spaces.communityid, communityid), eq(spaces.adminonly, true)));
  const isStaff = ROLE_RANK[role] >= ROLE_RANK.moderator;
  for (const s of adminSpaces) {
    if (isStaff) await addConversationMember({ conversationid: s.conversationid, userid: targetuserid });
    else
      await db
        .delete(conversationmembers)
        .where(and(eq(conversationmembers.conversationid, s.conversationid), eq(conversationmembers.userid, targetuserid)));
  }
  await audit(db, communityid, actorid, "role_changed", { userid: targetuserid, role });
}

export async function removeMember(communityid: string, targetuserid: string, actorid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [member] = await db
    .select()
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, targetuserid)))
    .limit(1);
  if (!member) throw new EngineError("member_not_found", 404);
  if (member.role === "owner" && (await ownerCount(db, communityid)) <= 1) {
    throw new EngineError("last_owner", 409, "cannot remove the last owner");
  }

  // Remove from the community + from every space conversation (revoke access).
  await db
    .delete(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, targetuserid)));
  const sp = await db.select({ conversationid: spaces.conversationid }).from(spaces).where(eq(spaces.communityid, communityid));
  const convIds = sp.map((s) => s.conversationid);
  if (convIds.length) {
    await db
      .delete(conversationmembers)
      .where(and(eq(conversationmembers.userid, targetuserid), inArray(conversationmembers.conversationid, convIds)));
  }
  await audit(db, communityid, actorid, "member_removed", { userid: targetuserid });
}

export async function listAudit(communityid: string, limit = 100): Promise<(typeof communityauditlog.$inferSelect)[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(communityauditlog)
    .where(eq(communityauditlog.communityid, communityid))
    .orderBy(desc(communityauditlog.createdat))
    .limit(limit);
}

/** Add all current community members to a newly created space's conversation. */
export async function syncSpaceMembers(communityid: string, conversationid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const members = await db.select({ userid: communitymembers.userid }).from(communitymembers).where(eq(communitymembers.communityid, communityid));
  for (const m of members) await addConversationMember({ conversationid, userid: m.userid });
}
