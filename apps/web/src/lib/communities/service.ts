import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { users } from "../db/auth-schema";
import {
  communities,
  communitymembers,
  joinrequests,
  spaces,
  type CommunityRow,
  type Discoverability,
  type JoinPolicy,
  type SpaceRow,
} from "../db/communities-schema";
import { EngineError } from "../engine/errors";
import { createConversation, deleteChannel, deleteConversation, registerChannel } from "../engine/service";
import { isStricterOrEqualDiscover, isStricterOrEqualJoin, isStrictlyStricterJoin } from "./policy";
import { syncCorpToSpace, syncSpaceMembers, syncStaffToSpace } from "./membership";
import { configureSpaceAi, type ConfigureSpaceAiInput } from "./spaceai";
import { indexSpaceAi } from "./spaceai-index";

/**
 * Spec 017 (Communities) T001 — community + space service.
 *
 * A community owns a backing native `yappchat-internal` channel; its spaces are
 * spec 001 conversations of kind `space` under that channel. The acting user is
 * added to a new space's `conversationmembers` (spec 001 T009 core) so the
 * membership-gated `conversation:{id}` scope works immediately.
 */

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "community"
  );
}

/** First free slug among `base`, `base-2`, `base-3`, … (case the name repeats). */
async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  if (!db) return base;
  for (let n = 1; n <= 10_000; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [existing] = await db.select({ id: communities.id }).from(communities).where(eq(communities.slug, slug)).limit(1);
    if (!existing) return slug;
  }
  // Extremely unlikely fallback — keep it collision-proof rather than throwing.
  return `${base}-${Date.now()}`;
}

async function loadCommunity(id: string): Promise<CommunityRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(communities).where(eq(communities.id, id)).limit(1);
  if (!row) throw new EngineError("community_not_found", 404);
  return row;
}

// ── Communities ──────────────────────────────────────────────────────────────

export async function createCommunity(
  input: {
    name: string;
    description?: string;
    avatarurl?: string;
    slug?: string;
    discoverability?: Discoverability;
    joinpolicy?: JoinPolicy;
  },
  ownerid: string,
): Promise<CommunityRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  // Backing native connection that will host this community's space conversations.
  const channel = await registerChannel({ platformid: "yappchat-internal", name: input.name });

  const id = uuidv7();
  const slug = await uniqueSlug(slugify(input.slug ?? input.name));
  await db.insert(communities).values({
    id,
    slug,
    name: input.name,
    description: input.description ?? "",
    avatarurl: input.avatarurl ?? null,
    ownerid,
    channelid: channel.id,
    discoverability: input.discoverability ?? "unlisted",
    joinpolicy: input.joinpolicy ?? "approval",
  });
  // The creator is the first owner.
  await db.insert(communitymembers).values({ id: uuidv7(), communityid: id, userid: ownerid, role: "owner" });

  // Auto-create the Administration space: owners/mods only (invite-only + hidden).
  // Only the owner exists now, so syncStaffToSpace seeds it with just them.
  await createSpace(id, {
    name: "Administration",
    topic: "Internal — owners & moderators only",
    joinpolicy: "invite",
    discoverability: "unlisted",
    adminonly: true,
  });

  return loadCommunity(id);
}

export async function getCommunity(id: string): Promise<CommunityRow> {
  return loadCommunity(id);
}

/** Communities the user belongs to (their home list), with the caller's availability. */
export async function listMyCommunities(
  userid: string,
): Promise<Array<CommunityRow & { role: string; availabilitystatus: string | null; availabilitynote: string | null }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      community: communities,
      role: communitymembers.role,
      availabilitystatus: communitymembers.availabilitystatus,
      availabilitynote: communitymembers.availabilitynote,
    })
    .from(communitymembers)
    .innerJoin(communities, eq(communitymembers.communityid, communities.id))
    .where(eq(communitymembers.userid, userid))
    .orderBy(desc(communities.createdat));
  return rows.map((r) => ({
    ...r.community,
    role: r.role,
    availabilitystatus: r.availabilitystatus,
    availabilitynote: r.availabilitynote,
  }));
}

/** Spec 068 — set the caller's own per-community availability (status + note). */
export async function setAvailability(
  communityid: string,
  userid: string,
  patch: { availabilitystatus?: string | null; availabilitynote?: string | null },
): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  if (Object.keys(patch).length === 0) return;
  await db
    .update(communitymembers)
    .set(patch)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, userid)));
}

export async function updateCommunity(
  id: string,
  patch: {
    name?: string;
    description?: string;
    avatarurl?: string | null;
    discoverability?: Discoverability;
    joinpolicy?: JoinPolicy;
    retentionpolicy?: "forever" | "days";
    retentiondays?: number | null;
  },
): Promise<CommunityRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await loadCommunity(id);
  await db
    .update(communities)
    .set({ ...patch, updatedat: new Date() })
    .where(eq(communities.id, id));
  return loadCommunity(id);
}

/**
 * Delete a community and everything under it. The `communities` row cascades to
 * members, spaces, invites, join-requests, audit log, and per-space AI rows;
 * deleting the backing channel then cascades its conversations + messages. The
 * community row goes first (so spaces, which FK the conversations, are gone
 * before the channel/conversations are removed).
 */
export async function deleteCommunity(id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const community = await loadCommunity(id);
  await db.delete(communities).where(eq(communities.id, id));
  await deleteChannel(community.channelid);
}

// ── Spaces ───────────────────────────────────────────────────────────────────

export async function createSpace(
  communityid: string,
  input: {
    name: string;
    topic?: string;
    mode?: "chat" | "broadcast";
    discoverability?: Discoverability;
    joinpolicy?: JoinPolicy;
    // Owners/mods-only space (regular members never auto-join). Set for the
    // auto-created Administration space.
    adminonly?: boolean;
    // Corp-only space: only the owner's org members (+ owners/mods) are members.
    corponly?: boolean;
    // Spec 017 FR-019 — optionally enable the per-space support AI at creation.
    ai?: ConfigureSpaceAiInput;
  },
): Promise<SpaceRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const community = await loadCommunity(communityid);

  // A space override may only be STRICTER than (or equal to) the community.
  if (input.joinpolicy && !isStricterOrEqualJoin(community.joinpolicy, input.joinpolicy)) {
    throw new EngineError("space_joinpolicy_looser", 400, "space join policy must be at least as strict as the community");
  }
  if (input.discoverability && !isStricterOrEqualDiscover(community.discoverability, input.discoverability)) {
    throw new EngineError("space_discoverability_looser", 400, "space discoverability must be at least as strict as the community");
  }

  // The space's messages live in a spec 001 conversation (kind `space`).
  const conversation = await createConversation(community.channelid, { title: input.name, kind: "space" });

  const id = uuidv7();
  await db.insert(spaces).values({
    id,
    communityid,
    conversationid: conversation.id,
    name: input.name,
    topic: input.topic ?? "",
    mode: input.mode ?? "chat",
    discoverability: input.discoverability ?? null,
    joinpolicy: input.joinpolicy ?? null,
    adminonly: input.adminonly ?? false,
    corponly: input.corponly ?? false,
  });

  // Seed membership by the space's entry level: admin/gated → owners/mods only;
  // corp-only → owners/mods + the owner's org members; otherwise every member.
  const gated = input.adminonly || (input.joinpolicy != null && isStrictlyStricterJoin(community.joinpolicy, input.joinpolicy));
  if (input.corponly) await syncCorpToSpace(communityid, conversation.id);
  else if (gated) await syncStaffToSpace(communityid, conversation.id);
  else await syncSpaceMembers(communityid, conversation.id);

  // FR-019 — if the creator opted into AI, persist config + sources and kick off
  // indexing in the background so the create request still returns fast.
  if (input.ai?.enabled) {
    await configureSpaceAi(id, input.ai);
    void indexSpaceAi(id).catch((err) => console.error("[spaceai] initial index failed:", err));
  }

  const [row] = await db.select().from(spaces).where(eq(spaces.id, id)).limit(1);
  return row;
}

export async function listSpaces(communityid: string): Promise<SpaceRow[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(spaces).where(eq(spaces.communityid, communityid)).orderBy(spaces.createdat);
}

/** Load a space, asserting it belongs to the given community (404 otherwise). */
async function loadSpace(communityid: string, spaceid: string): Promise<SpaceRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db
    .select()
    .from(spaces)
    .where(and(eq(spaces.id, spaceid), eq(spaces.communityid, communityid)))
    .limit(1);
  if (!row) throw new EngineError("space_not_found", 404);
  return row;
}

export async function updateSpace(
  communityid: string,
  spaceid: string,
  patch: {
    name?: string;
    topic?: string;
    mode?: "chat" | "broadcast";
    discoverability?: Discoverability | null;
    joinpolicy?: JoinPolicy | null;
    adminonly?: boolean;
    corponly?: boolean;
  },
): Promise<SpaceRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const community = await loadCommunity(communityid);
  await loadSpace(communityid, spaceid);

  // A space override may only be STRICTER than (or equal to) the community.
  if (patch.joinpolicy && !isStricterOrEqualJoin(community.joinpolicy, patch.joinpolicy)) {
    throw new EngineError("space_joinpolicy_looser", 400, "space join policy must be at least as strict as the community");
  }
  if (patch.discoverability && !isStricterOrEqualDiscover(community.discoverability, patch.discoverability)) {
    throw new EngineError("space_discoverability_looser", 400, "space discoverability must be at least as strict as the community");
  }

  await db.update(spaces).set(patch).where(eq(spaces.id, spaceid));
  return loadSpace(communityid, spaceid);
}

/** Delete a space + its backing conversation (cascades messages and AI rows). */
export async function deleteSpace(communityid: string, spaceid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const space = await loadSpace(communityid, spaceid);
  await db.delete(spaces).where(eq(spaces.id, spaceid));
  await deleteConversation(space.conversationid);
}

export type DiscoverResult = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarurl: string | null;
  joinpolicy: JoinPolicy;
  membercount: number;
  isMember: boolean;
  requested: boolean;
};

/**
 * Spec 017 T003 — public community discovery. Lists/searches ONLY `public`
 * communities (unlisted are never returned), with member count and the caller's
 * relationship (already a member / has a pending request) so the UI can show the
 * right join affordance.
 */
export async function discoverCommunities(userid: string, q: string, limit = 50): Promise<DiscoverResult[]> {
  const db = getDb();
  if (!db) return [];
  const term = q.trim();
  const filters = [eq(communities.discoverability, "public")];
  if (term) {
    filters.push(or(ilike(communities.name, `%${term}%`), ilike(communities.description, `%${term}%`))!);
  }
  const rows = await db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
      description: communities.description,
      avatarurl: communities.avatarurl,
      joinpolicy: communities.joinpolicy,
    })
    .from(communities)
    .where(and(...filters))
    .orderBy(desc(communities.createdat))
    .limit(limit);
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({ cid: communitymembers.communityid, n: count() })
    .from(communitymembers)
    .where(inArray(communitymembers.communityid, ids))
    .groupBy(communitymembers.communityid);
  const countMap = new Map(counts.map((c) => [c.cid, Number(c.n)]));

  const mine = await db
    .select({ cid: communitymembers.communityid })
    .from(communitymembers)
    .where(and(eq(communitymembers.userid, userid), inArray(communitymembers.communityid, ids)));
  const memberSet = new Set(mine.map((m) => m.cid));

  const reqs = await db
    .select({ cid: joinrequests.communityid })
    .from(joinrequests)
    .where(
      and(eq(joinrequests.userid, userid), eq(joinrequests.status, "pending"), inArray(joinrequests.communityid, ids)),
    );
  const requestedSet = new Set(reqs.map((r) => r.cid));

  return rows.map((r) => ({
    ...r,
    membercount: countMap.get(r.id) ?? 0,
    isMember: memberSet.has(r.id),
    requested: requestedSet.has(r.id),
  }));
}

export type CommunityMember = {
  userid: string;
  displayname: string;
  email: string;
  role: string;
  joinedat: Date | null;
};

/** Members of a community (directory), each with the spec 011 account identity. */
export async function listMembers(communityid: string): Promise<CommunityMember[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select({
      userid: communitymembers.userid,
      displayname: users.displayname,
      email: users.email,
      role: communitymembers.role,
      joinedat: communitymembers.joinedat,
    })
    .from(communitymembers)
    .innerJoin(users, eq(communitymembers.userid, users.id))
    .where(eq(communitymembers.communityid, communityid))
    .orderBy(communitymembers.joinedat);
}

/** The caller's role in a community, or null if not a member. */
export async function memberRole(communityid: string, userid: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [m] = await db
    .select({ role: communitymembers.role })
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, userid)))
    .limit(1);
  return m?.role ?? null;
}
