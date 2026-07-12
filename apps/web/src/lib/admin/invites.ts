import { and, eq, gt, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { authauditlog, orginvitations, orgs, users } from "../db/auth-schema";
import { communities, communityinvites, spaces } from "../db/communities-schema";
import { EngineError } from "../engine/errors";
import { inviteOrgMember, revokeInvite as revokeOrgInvite } from "../orgs/service";
import { createInvite, createSpaceInvite, revokeInvite as revokeCommunityInvite } from "../communities/membership";

/**
 * Spec 013 FR-019 — Global invite console (system admin).
 *
 * A cross-org, read+manage surface over BOTH invite systems: company/org member
 * invites (spec 011 `orginvitations`) and community/space invite links (spec 017
 * `communityinvites`, incl. FR-021 reusable). This module is a consumer/orchestrator
 * — it aggregates for display and PROXIES the 011/017 service functions for
 * create/revoke, never reimplementing their logic. Every mutation writes an
 * attributed `authauditlog` row (FR-018).
 */

export type AdminInviteType = "company" | "community" | "space";
export type AdminInviteSource = "org" | "community";

export type AdminInvite = {
  source: AdminInviteSource;
  type: AdminInviteType;
  id: string;
  target: string; // company name, or "community" / "community › space"
  invitedbyemail: string | null;
  email: string | null; // company invites are email-bound
  usecount: number | null; // community invites (FR-021)
  maxuses: number | null;
  remaining: number | null;
  expiresat: string;
  createdat: string;
};

type Db = NonNullable<ReturnType<typeof getDb>>;

async function audit(db: Db, actorid: string, eventtype: string, payload: unknown): Promise<void> {
  await db.insert(authauditlog).values({ id: uuidv7(), userid: actorid, eventtype, payload: payload ?? null });
}

/** Aggregated list of LIVE invites across the whole deployment (FR-019). */
export async function listAllInvites(filter?: { type?: AdminInviteType; q?: string }): Promise<AdminInvite[]> {
  const db = getDb();
  if (!db) return [];
  const now = new Date();

  const companyRows = await db
    .select({
      id: orginvitations.id,
      email: orginvitations.email,
      expiresat: orginvitations.expiresat,
      createdat: orginvitations.createdat,
      orgname: orgs.name,
      invitedbyemail: users.email,
    })
    .from(orginvitations)
    .innerJoin(orgs, eq(orgs.id, orginvitations.orgid))
    .leftJoin(users, eq(users.id, orginvitations.invitedby))
    .where(and(isNull(orginvitations.consumedat), gt(orginvitations.expiresat, now)));

  const communityRows = await db
    .select({
      id: communityinvites.id,
      spaceid: communityinvites.spaceid,
      maxuses: communityinvites.maxuses,
      usecount: communityinvites.usecount,
      expiresat: communityinvites.expiresat,
      createdat: communityinvites.createdat,
      communityname: communities.name,
      spacename: spaces.name,
      invitedbyemail: users.email,
    })
    .from(communityinvites)
    .innerJoin(communities, eq(communities.id, communityinvites.communityid))
    .leftJoin(spaces, eq(spaces.id, communityinvites.spaceid))
    .leftJoin(users, eq(users.id, communityinvites.createdby))
    .where(and(isNull(communityinvites.usedat), gt(communityinvites.expiresat, now)));

  const company: AdminInvite[] = companyRows.map((r) => ({
    source: "org",
    type: "company",
    id: r.id,
    target: r.orgname,
    invitedbyemail: r.invitedbyemail ?? null,
    email: r.email,
    usecount: null,
    maxuses: null,
    remaining: null,
    expiresat: r.expiresat.toISOString(),
    createdat: r.createdat.toISOString(),
  }));

  const community: AdminInvite[] = communityRows.map((r) => ({
    source: "community",
    type: r.spaceid ? "space" : "community",
    id: r.id,
    target: r.spacename ? `${r.communityname} › ${r.spacename}` : r.communityname,
    invitedbyemail: r.invitedbyemail ?? null,
    email: null,
    usecount: r.usecount,
    maxuses: r.maxuses,
    remaining: r.maxuses == null ? null : Math.max(0, r.maxuses - r.usecount),
    expiresat: r.expiresat.toISOString(),
    createdat: r.createdat.toISOString(),
  }));

  let all = [...company, ...community];
  if (filter?.type) all = all.filter((i) => i.type === filter.type);
  if (filter?.q) {
    const q = filter.q.trim().toLowerCase();
    if (q) all = all.filter((i) => i.target.toLowerCase().includes(q) || (i.email ?? "").toLowerCase().includes(q));
  }
  return all.sort((a, b) => (a.createdat < b.createdat ? 1 : -1));
}

export type AdminCreateInput =
  | { type: "company"; orgid: string; email: string; role: "admin" | "member" }
  | { type: "community"; communityid: string; maxuses?: number | null; ttlHours?: number }
  | { type: "space"; communityid: string; spaceid: string; maxuses?: number | null; ttlHours?: number };

export type AdminCreateResult =
  | { kind: "company"; email: string }
  | { kind: "link"; token: string; expiresat: string };

/** Create an invite into any company (011) or any community/space (017). FR-019. */
export async function adminCreateInvite(input: AdminCreateInput, actorid: string): Promise<AdminCreateResult> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  if (input.type === "company") {
    await inviteOrgMember({ orgid: input.orgid, email: input.email, role: input.role, invitedby: actorid });
    await audit(db, actorid, "admin_invite_created", { type: "company", orgid: input.orgid, email: input.email, role: input.role });
    return { kind: "company", email: input.email.trim().toLowerCase() };
  }

  const { token, expiresat } =
    input.type === "space"
      ? await createSpaceInvite(input.communityid, input.spaceid, actorid, input.ttlHours ?? 72, input.maxuses ?? 1)
      : await createInvite(input.communityid, actorid, input.ttlHours ?? 72, input.maxuses ?? 1);
  await audit(db, actorid, "admin_invite_created", {
    type: input.type,
    communityid: input.communityid,
    spaceid: input.type === "space" ? input.spaceid : null,
    maxuses: input.maxuses ?? 1,
  });
  return { kind: "link", token, expiresat: expiresat.toISOString() };
}

/** Revoke any live invite by source + id (proxies 011 org-revoke / 017 revoke). FR-019. */
export async function adminRevokeInvite(source: AdminInviteSource, id: string, actorid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  if (source === "org") {
    const [row] = await db.select({ orgid: orginvitations.orgid }).from(orginvitations).where(eq(orginvitations.id, id)).limit(1);
    if (!row) throw new EngineError("invite_not_found", 404);
    await revokeOrgInvite(row.orgid, id);
    await audit(db, actorid, "admin_invite_revoked", { source, id, orgid: row.orgid });
    return;
  }

  const [row] = await db
    .select({ communityid: communityinvites.communityid })
    .from(communityinvites)
    .where(eq(communityinvites.id, id))
    .limit(1);
  if (!row) throw new EngineError("invite_not_found", 404);
  await revokeCommunityInvite(row.communityid, id, actorid); // 017 writes its own communityauditlog row too
  await audit(db, actorid, "admin_invite_revoked", { source, id, communityid: row.communityid });
}

export type InviteTargets = {
  orgs: { id: string; name: string }[];
  communities: { id: string; name: string; spaces: { id: string; name: string; reusable: boolean }[] }[];
};

/** Targets for the create form: corporate orgs + communities with their spaces. FR-019. */
export async function listInviteTargets(): Promise<InviteTargets> {
  const db = getDb();
  if (!db) return { orgs: [], communities: [] };

  const orgRows = await db
    .select({ id: orgs.id, name: orgs.name })
    .from(orgs)
    .where(eq(orgs.plantype, "corporate"))
    .orderBy(orgs.name);

  const commRows = await db.select({ id: communities.id, name: communities.name }).from(communities).orderBy(communities.name);
  const spaceRows = await db
    .select({ id: spaces.id, name: spaces.name, communityid: spaces.communityid, adminonly: spaces.adminonly, corponly: spaces.corponly })
    .from(spaces);

  const communitiesOut = commRows.map((c) => ({
    id: c.id,
    name: c.name,
    spaces: spaceRows
      .filter((s) => s.communityid === c.id)
      .map((s) => ({ id: s.id, name: s.name, reusable: !s.adminonly && !s.corponly })),
  }));

  return { orgs: orgRows, communities: communitiesOut };
}
