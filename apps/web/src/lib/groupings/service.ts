import { and, asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { chatgroupings, type ChatGroupingRow, type GroupingType } from "../db/groupings-schema";
import { conversationmembers } from "../db/engine-schema";
import { EngineError } from "../engine/errors";
import { isUniqueViolation } from "../db/errors";
import { normalizeGroupingName, normalizeGroupingType, normalizePosition } from "./validation";
import { createRoom } from "../contacts/service";
import { postSystemMessage } from "../engine/service";

/** Author id for the project-room opening message (the room id, for remote binding). */
const PROJECT_SYSTEM_AUTHOR = "yappchat-project";

/**
 * Spec 090 — Chat Groupings Foundation service.
 *
 * Per-user "folders" for the sidebar chat list. Every operation is scoped to the
 * caller's `userid`: a user may only touch their own groupings and their own
 * `conversationmembers` rows (FR-012). Placement is view-layer only and never
 * changes room membership or access (FR-006). Deleting a grouping returns its
 * rooms to ungrouped via ON DELETE SET NULL with zero data loss (FR-007).
 */

export type GroupingDTO = { id: string; name: string; type: GroupingType; position: number };

function toDTO(row: ChatGroupingRow): GroupingDTO {
  return { id: row.id, name: row.name, type: row.type as GroupingType, position: row.position };
}

/** FR-001/009 — the caller's own groupings, ordered by position then name. */
export async function listGroupings(userid: string): Promise<GroupingDTO[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(chatgroupings)
    .where(eq(chatgroupings.userid, userid))
    .orderBy(asc(chatgroupings.position), asc(chatgroupings.name));
  return rows.map(toDTO);
}

/** FR-001 — create a grouping owned by the caller. Duplicate name → 409. */
export async function createGrouping(
  userid: string,
  input: { name?: unknown; type?: unknown; position?: unknown },
): Promise<GroupingDTO> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const name = normalizeGroupingName(input.name);
  const type = normalizeGroupingType(input.type ?? "general");
  const position = normalizePosition(input.position);
  const id = uuidv7();
  try {
    await db.insert(chatgroupings).values({ id, userid, name, type, position });
  } catch (err) {
    if (isUniqueViolation(err)) throw new EngineError("duplicate_name", 409, "a grouping with that name exists");
    throw err;
  }
  const [row] = await db.select().from(chatgroupings).where(eq(chatgroupings.id, id)).limit(1);
  return toDTO(row);
}

/** Load a grouping and assert the caller owns it (FR-012). Throws 404 otherwise. */
async function requireOwnGrouping(userid: string, id: string): Promise<ChatGroupingRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db
    .select()
    .from(chatgroupings)
    .where(and(eq(chatgroupings.id, id), eq(chatgroupings.userid, userid)))
    .limit(1);
  if (!row) throw new EngineError("grouping_not_found", 404);
  return row;
}

/** FR-002 — rename / reorder / change type of the caller's own grouping. */
export async function updateGrouping(
  userid: string,
  id: string,
  patch: { name?: unknown; type?: unknown; position?: unknown },
): Promise<GroupingDTO> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await requireOwnGrouping(userid, id);
  const values: Partial<{ name: string; type: GroupingType; position: number }> = {};
  if (patch.name !== undefined) values.name = normalizeGroupingName(patch.name);
  if (patch.type !== undefined) values.type = normalizeGroupingType(patch.type);
  if (patch.position !== undefined) values.position = normalizePosition(patch.position);
  if (Object.keys(values).length === 0) throw new EngineError("no_changes", 400);
  try {
    await db
      .update(chatgroupings)
      .set(values)
      .where(and(eq(chatgroupings.id, id), eq(chatgroupings.userid, userid)));
  } catch (err) {
    if (isUniqueViolation(err)) throw new EngineError("duplicate_name", 409, "a grouping with that name exists");
    throw err;
  }
  const [row] = await db.select().from(chatgroupings).where(eq(chatgroupings.id, id)).limit(1);
  return toDTO(row);
}

/**
 * FR-002/007 — delete the caller's own grouping. The FK (ON DELETE SET NULL) nulls
 * `groupingid` on every affected `conversationmembers` row, so the rooms fall back
 * to ungrouped; no room, membership, or message is deleted.
 */
export async function deleteGrouping(userid: string, id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await requireOwnGrouping(userid, id);
  await db.delete(chatgroupings).where(and(eq(chatgroupings.id, id), eq(chatgroupings.userid, userid)));
}

/**
 * FR-004/005/006/012 — set the caller's placement of a room: assign to one of the
 * caller's groupings, move between groupings, or remove (groupingid = null). Only
 * the caller's OWN `conversationmembers` row is touched; the room, its membership,
 * and every other member's view are untouched.
 */
export async function setRoomGrouping(
  userid: string,
  conversationid: string,
  input: { groupingid?: string | null; position?: unknown },
): Promise<{ ok: true }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  // The caller must be a member of the room (their own membership row must exist).
  const [membership] = await db
    .select({ id: conversationmembers.id })
    .from(conversationmembers)
    .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)))
    .limit(1);
  if (!membership) throw new EngineError("not_a_member", 404);

  const groupingid = input.groupingid ?? null;
  if (groupingid !== null) {
    // Assigning to a grouping requires the caller to own that grouping.
    await requireOwnGrouping(userid, groupingid);
  }
  const position = input.position === undefined ? null : normalizePosition(input.position);

  await db
    .update(conversationmembers)
    .set({ groupingid, position })
    .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)));
  return { ok: true };
}

/**
 * Spec 090 (room-creation extension) — create a NEW room already filed under one of
 * the caller's groupings. Members are optional: **0 members = a solo room** — the
 * remote-management room bound to Claude in SPEC-091. A solo room must have a name.
 * A **solo** room surfaces its own room id as its **first message** so the caller
 * (or Claude) has the id to connect for remote management — there is no accept step.
 */
export async function createRoomInGrouping(
  creatorid: string,
  input: { title?: unknown; memberIds?: unknown; groupingid: string },
): Promise<{ conversationid: string }> {
  await requireOwnGrouping(creatorid, input.groupingid);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const memberIds = Array.isArray(input.memberIds) ? (input.memberIds.filter((x) => typeof x === "string") as string[]) : [];
  const solo = memberIds.length === 0;
  if (solo && !title) {
    throw new EngineError("name_required", 400, "a solo room needs a name");
  }

  const { conversationid } = await createRoom(creatorid, memberIds, { title });
  // File it under the grouping for the creator (reuses the ownership + membership guards).
  await setRoomGrouping(creatorid, conversationid, { groupingid: input.groupingid });

  // A solo room surfaces its id as the opening message (the remote-management handle
  // to hand to Claude). No other party, so no accept step.
  if (solo) {
    await postSystemMessage({
      conversationid,
      authorid: PROJECT_SYSTEM_AUTHOR,
      authorname: "Project",
      content: conversationid,
    });
  }
  return { conversationid };
}
