import type { ConsumerDeps } from "./deps";
import { ConsumerError } from "./errors";
import type { ConsumerRoom, ConsumerTx } from "./store";
import { isUuid, requireName, requireUuid } from "./validate";

/**
 * SPEC-093 FR-005 / FR-006 — project rooms (C1.6–C1.9).
 *
 * A project room is a `group` conversation on the internal direct channel, owned
 * by the company account (conversationmembers.role = 'owner') and filed in the
 * owner's `projects` chat grouping (created when missing, SPEC-090). Members are
 * added directly — no contact or invitation step, because wxKanban is the source
 * of truth for who belongs in a company's project room.
 *
 * Only `group` conversations are reachable: DMs, community spaces and support
 * threads are reported as not found, so this API cannot touch them.
 *
 * Retiring sets conversations.retiredat: the room drops out of every member's
 * list except the owner's (contacts/service.ts listMyChats), and every posting
 * path refuses new messages (engine/service.ts, via retired.ts). Nothing is
 * deleted, so the owner keeps the full history.
 */

// [SCOPE 093 / T005] BEGIN — Projects grouping name
export const PROJECTS_GROUPING_NAME = "Projects";
const PROJECTS_GROUPING_FALLBACK = "wxKanban Projects";
const MAX_ROOM_MEMBERS = 500;
// [SCOPE 093 / T005] END

// [SCOPE 093 / T005] BEGIN — loadRoom
async function loadRoom(tx: ConsumerTx, conversationid: string): Promise<ConsumerRoom> {
  const room = isUuid(conversationid) ? await tx.lockRoom(conversationid.toLowerCase()) : null;
  if (!room || room.kind !== "group") throw new ConsumerError("room_not_found", 404);
  return room;
}
// [SCOPE 093 / T005] END

// [SCOPE 093 / T005] BEGIN — ensureProjectsGrouping
/** The owner's `projects` grouping, created under "Projects" (or a fallback name). */
async function ensureProjectsGrouping(tx: ConsumerTx, owner: string): Promise<string> {
  const existing = await tx.findProjectsGrouping(owner);
  if (existing) return existing;
  const created =
    (await tx.insertProjectsGrouping(owner, PROJECTS_GROUPING_NAME)) ??
    (await tx.insertProjectsGrouping(owner, PROJECTS_GROUPING_FALLBACK));
  if (!created) throw new ConsumerError("grouping_unavailable", 409);
  return created;
}
// [SCOPE 093 / T005] END

// [SCOPE 093 / T005] BEGIN — createProjectRoom
export async function createProjectRoom(
  deps: ConsumerDeps,
  body: Record<string, unknown>,
): Promise<{ conversationid: string }> {
  const owner = requireUuid(body.ownerUserid, "ownerUserid");
  const title = requireName(body.title, "title");
  if (!Array.isArray(body.memberIds) || body.memberIds.length > MAX_ROOM_MEMBERS) {
    throw new ConsumerError("invalid_request", 400, { field: "memberIds" });
  }
  const memberIds = [
    ...new Set(body.memberIds.map((id, i) => requireUuid(id, `memberIds[${i}]`))),
  ].filter((id) => id !== owner);

  return deps.store.run(async (tx) => {
    const found = new Set(await tx.existingUserIds([owner, ...memberIds]));
    if (!found.has(owner) || memberIds.some((id) => !found.has(id))) {
      throw new ConsumerError("user_not_found", 404);
    }
    const groupingid = await ensureProjectsGrouping(tx, owner);
    const conversationid = deps.newId();
    await tx.insertRoom({ id: conversationid, channelid: await tx.directChannelId(), title });
    await tx.insertRoomMember({ conversationid, userid: owner, role: "owner", groupingid });
    for (const userid of memberIds) {
      await tx.insertRoomMember({ conversationid, userid, role: "member", groupingid: null });
    }
    return { conversationid };
  });
}
// [SCOPE 093 / T005] END

// [SCOPE 093 / T005] BEGIN — putRoomMember
/** C1.7 — add a member. Already a member → `added: false`. A retired room → 409. */
export async function putRoomMember(
  deps: ConsumerDeps,
  conversationid: string,
  userid: string,
): Promise<{ added: boolean }> {
  return deps.store.run(async (tx) => {
    const room = await loadRoom(tx, conversationid);
    if (room.retiredat) throw new ConsumerError("room_retired", 409);
    if (!isUuid(userid) || !(await tx.userExists(userid.toLowerCase()))) {
      throw new ConsumerError("user_not_found", 404);
    }
    const uid = userid.toLowerCase();
    if (await tx.isRoomMember(room.id, uid)) return { added: false };
    await tx.insertRoomMember({ conversationid: room.id, userid: uid, role: "member", groupingid: null });
    return { added: true };
  });
}
// [SCOPE 093 / T005] END

// [SCOPE 093 / T005] BEGIN — deleteRoomMember
// MODIFIED-BY: [SCOPE 093 / T010] — the room owner is refused with 409 owner_protected (Amendment A)
/** C1.8 — remove a member. Not a member → `removed: false`; the owner → 409 owner_protected. */
export async function deleteRoomMember(
  deps: ConsumerDeps,
  conversationid: string,
  userid: string,
): Promise<{ removed: boolean }> {
  return deps.store.run(async (tx) => {
    const room = await loadRoom(tx, conversationid);
    if (!isUuid(userid)) return { removed: false };
    const uid = userid.toLowerCase();
    const role = await tx.getRoomRole(room.id, uid);
    if (role === null) return { removed: false };
    if (role === "owner") throw new ConsumerError("owner_protected", 409);
    await tx.deleteRoomMember(room.id, uid);
    return { removed: true };
  });
}
// [SCOPE 093 / T005] END

// [SCOPE 093 / T006] BEGIN — retireRoom
/** C1.9 — retire. Already retired → the existing `retiredat`, unchanged. */
export async function retireRoom(
  deps: ConsumerDeps,
  conversationid: string,
): Promise<{ retired: true; retiredat: string }> {
  return deps.store.run(async (tx) => {
    const room = await loadRoom(tx, conversationid);
    if (room.retiredat) return { retired: true, retiredat: room.retiredat.toISOString() };
    const at = deps.now();
    await tx.setRoomRetired(room.id, at);
    return { retired: true, retiredat: at.toISOString() };
  });
}
// [SCOPE 093 / T006] END
