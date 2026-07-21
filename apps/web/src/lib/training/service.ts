import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { spaces } from "../db/communities-schema";
import { presentationrecordings } from "../db/presentations-schema";
import {
  trainingcourses,
  trainingitems,
  trainingprogress,
  type TrainingCourseRow,
  type TrainingItemRow,
  type TrainingItemType,
} from "../db/training-schema";
import { isConversationMember } from "../engine/service";
import { getPresentationForViewer } from "../presentations/service";
import { presignGet, presignPut, presignShare, storageConfigured } from "../storage/s3";
import { EngineError } from "../engine/errors";

/**
 * Spec 092 (Training) — service for the self-paced course library.
 *
 * Access model: a course belongs to a **space** (spec 017); all access follows
 * that space's membership, checked through the space's backing conversation
 * (`isConversationMember`). There is no per-course visibility of its own.
 *
 * Authoring: FR-008 grants authoring to "any presentation host". The platform
 * (spec 071) lets ANY signed-in user host a presentation, so in practice any
 * member of the space may author — `assertCanAuthor` is the single seam to
 * tighten later (e.g. to space owners/mods) without touching callers.
 */

// ── Access helpers ──────────────────────────────────────────────────────────────

async function loadSpace(spaceid: string) {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceid)).limit(1);
  if (!space) throw new EngineError("space_not_found", 404);
  return space;
}

/** Assert the user is a member of the space (the access gate for viewing). */
export async function assertSpaceMember(spaceid: string, userid: string) {
  const space = await loadSpace(spaceid);
  if (!(await isConversationMember(space.conversationid, userid))) {
    throw new EngineError("forbidden", 403, "not a member of this space");
  }
  return space;
}

/**
 * Assert the user may author training in this space. v1: same as membership —
 * any presentation host (= any signed-in user) who belongs to the space. Single
 * seam: tighten here to gate authoring to owners/mods if the product changes.
 */
async function assertCanAuthor(spaceid: string, userid: string) {
  return assertSpaceMember(spaceid, userid);
}

async function loadCourse(courseid: string): Promise<TrainingCourseRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [course] = await db.select().from(trainingcourses).where(eq(trainingcourses.id, courseid)).limit(1);
  if (!course) throw new EngineError("course_not_found", 404);
  return course;
}

/** Load a course the viewer may see (space member; unpublished only for its author). */
async function assertCourseViewer(courseid: string, userid: string): Promise<TrainingCourseRow> {
  const course = await loadCourse(courseid);
  await assertSpaceMember(course.spaceid, userid);
  if (!course.published && course.createdby !== userid) {
    throw new EngineError("course_not_found", 404); // hide unpublished from non-authors
  }
  return course;
}

/** Load a course the actor may edit (author + space member). */
async function assertCourseAuthor(courseid: string, userid: string): Promise<TrainingCourseRow> {
  const course = await loadCourse(courseid);
  await assertCanAuthor(course.spaceid, userid);
  return course;
}

// ── Courses (T002 — FR-001/002/008) ──────────────────────────────────────────────

export type CourseSummary = {
  id: string;
  title: string;
  description: string;
  published: boolean;
  position: number;
  itemcount: number;
  completedcount: number;
  mine: boolean;
};

/**
 * The space's Training library for a member: published courses, plus the caller's
 * own unpublished drafts, each with the caller's progress (completed / total).
 */
export async function listCourses(spaceid: string, userid: string): Promise<CourseSummary[]> {
  await assertSpaceMember(spaceid, userid);
  const db = getDb();
  if (!db) return [];

  const courses = await db
    .select()
    .from(trainingcourses)
    .where(eq(trainingcourses.spaceid, spaceid))
    .orderBy(asc(trainingcourses.position), asc(trainingcourses.createdat));
  const visible = courses.filter((c) => c.published || c.createdby === userid);
  if (visible.length === 0) return [];

  const courseIds = visible.map((c) => c.id);
  const items = await db
    .select({ id: trainingitems.id, courseid: trainingitems.courseid })
    .from(trainingitems)
    .where(inArray(trainingitems.courseid, courseIds));
  const itemIds = items.map((i) => i.id);
  const done = itemIds.length
    ? await db
        .select({ itemid: trainingprogress.itemid })
        .from(trainingprogress)
        .where(and(inArray(trainingprogress.itemid, itemIds), eq(trainingprogress.userid, userid)))
    : [];
  const doneSet = new Set(done.map((d) => d.itemid));
  const itemToCourse = new Map(items.map((i) => [i.id, i.courseid]));

  const itemCount = new Map<string, number>();
  const completedCount = new Map<string, number>();
  for (const i of items) itemCount.set(i.courseid, (itemCount.get(i.courseid) ?? 0) + 1);
  for (const id of doneSet) {
    const cid = itemToCourse.get(id);
    if (cid) completedCount.set(cid, (completedCount.get(cid) ?? 0) + 1);
  }

  return visible.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    published: c.published,
    position: c.position,
    itemcount: itemCount.get(c.id) ?? 0,
    completedcount: completedCount.get(c.id) ?? 0,
    mine: c.createdby === userid,
  }));
}

export async function createCourse(
  spaceid: string,
  userid: string,
  input: { title: string; description?: string },
): Promise<TrainingCourseRow> {
  await assertCanAuthor(spaceid, userid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const title = input.title.trim();
  if (!title) throw new EngineError("title_required", 422, "a course title is required");

  const [{ value: maxPos }] = await db
    .select({ value: max(trainingcourses.position) })
    .from(trainingcourses)
    .where(eq(trainingcourses.spaceid, spaceid));

  const id = uuidv7();
  await db.insert(trainingcourses).values({
    id,
    spaceid,
    title,
    description: input.description?.trim() ?? "",
    createdby: userid,
    position: (maxPos ?? -1) + 1,
  });
  return loadCourse(id);
}

export type CourseItem = {
  id: string;
  position: number;
  type: TrainingItemType;
  title: string;
  // playable/viewable video items carry a presentation recording ref (opaque to the client);
  // the media URL is resolved lazily via the item media route (never embedded here).
  hasMedia: boolean;
  completed: boolean;
};

export type CourseDetail = {
  id: string;
  spaceid: string;
  title: string;
  description: string;
  published: boolean;
  mine: boolean; // caller is the author (may edit)
  items: CourseItem[];
  completedcount: number;
};

/** A course with its ordered items + the caller's own completion state (FR-009). */
export async function getCourse(courseid: string, userid: string): Promise<CourseDetail> {
  const course = await assertCourseViewer(courseid, userid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const items = await db
    .select()
    .from(trainingitems)
    .where(eq(trainingitems.courseid, courseid))
    .orderBy(asc(trainingitems.position), asc(trainingitems.createdat));
  const itemIds = items.map((i) => i.id);
  const done = itemIds.length
    ? await db
        .select({ itemid: trainingprogress.itemid })
        .from(trainingprogress)
        .where(and(inArray(trainingprogress.itemid, itemIds), eq(trainingprogress.userid, userid)))
    : [];
  const doneSet = new Set(done.map((d) => d.itemid));

  return {
    id: course.id,
    spaceid: course.spaceid,
    title: course.title,
    description: course.description,
    published: course.published,
    mine: course.createdby === userid,
    completedcount: doneSet.size,
    items: items.map((i) => ({
      id: i.id,
      position: i.position,
      type: i.type,
      title: i.title,
      hasMedia: itemHasMedia(i),
      completed: doneSet.has(i.id),
    })),
  };
}

/** FR-003 — whether an item of each type has its backing media set (pure, tested). */
export function itemHasMedia(i: Pick<TrainingItemRow, "type" | "presentationrecordingid" | "mediakey" | "documentkey">): boolean {
  if (i.type === "recording") return i.presentationrecordingid != null;
  if (i.type === "video") return i.mediakey != null;
  return i.documentkey != null;
}

/**
 * FR-002 — resolve a requested item order to the sequence to persist: only the
 * course's own items, in the requested order, de-duplicated. Ids not owned by the
 * course are ignored. Pure (tested); positions are the resulting indexes.
 */
export function orderItems(ownedIds: string[], requestedOrder: string[]): string[] {
  const owned = new Set(ownedIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of requestedOrder) {
    if (owned.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export async function updateCourse(
  courseid: string,
  userid: string,
  patch: { title?: string; description?: string; published?: boolean; itemorder?: string[] },
): Promise<TrainingCourseRow> {
  await assertCourseAuthor(courseid, userid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const set: Partial<TrainingCourseRow> = { updatedat: new Date() };
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new EngineError("title_required", 422);
    set.title = t;
  }
  if (patch.description !== undefined) set.description = patch.description.trim();
  if (patch.published !== undefined) set.published = patch.published;
  await db.update(trainingcourses).set(set).where(eq(trainingcourses.id, courseid));

  // Reorder items: apply the given order (positions 0..n), ignoring ids not in this course.
  if (patch.itemorder?.length) {
    const owned = await db
      .select({ id: trainingitems.id })
      .from(trainingitems)
      .where(eq(trainingitems.courseid, courseid));
    const seq = orderItems(owned.map((o) => o.id), patch.itemorder);
    for (let pos = 0; pos < seq.length; pos++) {
      await db.update(trainingitems).set({ position: pos }).where(eq(trainingitems.id, seq[pos]));
    }
  }
  return loadCourse(courseid);
}

export async function deleteCourse(courseid: string, userid: string): Promise<void> {
  await assertCourseAuthor(courseid, userid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await db.delete(trainingcourses).where(eq(trainingcourses.id, courseid)); // cascades items + progress
}

// ── Items (T003 — FR-003/005/006) ────────────────────────────────────────────────

export type AddItemInput =
  | { type: "recording"; title: string; presentationrecordingid: string }
  | { type: "video"; title: string; mediakey: string }
  | { type: "document"; title: string; documentkey: string };

export async function addItem(courseid: string, userid: string, input: AddItemInput): Promise<TrainingItemRow> {
  await assertCourseAuthor(courseid, userid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const title = input.title.trim();
  if (!title) throw new EngineError("title_required", 422);

  const values: typeof trainingitems.$inferInsert = {
    id: uuidv7(),
    courseid,
    type: input.type,
    title,
    position: 0,
  };

  if (input.type === "recording") {
    // FR-005 — reference an existing recording (no copy). Verify it exists + is live.
    const [rec] = await db
      .select({ id: presentationrecordings.id, presentationid: presentationrecordings.presentationid })
      .from(presentationrecordings)
      .where(
        and(
          eq(presentationrecordings.id, input.presentationrecordingid),
          isNull(presentationrecordings.deletedat),
        ),
      )
      .limit(1);
    if (!rec) throw new EngineError("recording_not_found", 404);
    // Authorization: the author may only reference a recording whose presentation
    // they can actually view — never trust a client-supplied recording id alone,
    // or an author could surface a private presentation's recording to the space.
    await getPresentationForViewer(rec.presentationid, userid);
    values.presentationrecordingid = input.presentationrecordingid;
  } else if (input.type === "video") {
    if (!input.mediakey) throw new EngineError("mediakey_required", 422);
    values.mediakey = input.mediakey;
  } else {
    if (!input.documentkey) throw new EngineError("documentkey_required", 422);
    values.documentkey = input.documentkey;
  }

  const [{ value: maxPos }] = await db
    .select({ value: max(trainingitems.position) })
    .from(trainingitems)
    .where(eq(trainingitems.courseid, courseid));
  values.position = (maxPos ?? -1) + 1;

  await db.insert(trainingitems).values(values);
  const [row] = await db.select().from(trainingitems).where(eq(trainingitems.id, values.id!)).limit(1);
  return row;
}

async function loadItemForAuthor(itemid: string, userid: string): Promise<TrainingItemRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [item] = await db.select().from(trainingitems).where(eq(trainingitems.id, itemid)).limit(1);
  if (!item) throw new EngineError("item_not_found", 404);
  await assertCourseAuthor(item.courseid, userid);
  return item;
}

/** Load an item the caller may view (course access via space membership). */
async function loadItemForViewer(itemid: string, userid: string): Promise<TrainingItemRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [item] = await db.select().from(trainingitems).where(eq(trainingitems.id, itemid)).limit(1);
  if (!item) throw new EngineError("item_not_found", 404);
  await assertCourseViewer(item.courseid, userid);
  return item;
}

export async function updateItem(
  itemid: string,
  userid: string,
  patch: { title?: string },
): Promise<TrainingItemRow> {
  const item = await loadItemForAuthor(itemid, userid);
  const db = getDb()!;
  const set: Partial<TrainingItemRow> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new EngineError("title_required", 422);
    set.title = t;
  }
  if (Object.keys(set).length) await db.update(trainingitems).set(set).where(eq(trainingitems.id, item.id));
  const [row] = await db.select().from(trainingitems).where(eq(trainingitems.id, item.id)).limit(1);
  return row;
}

export async function deleteItem(itemid: string, userid: string): Promise<void> {
  const item = await loadItemForAuthor(itemid, userid);
  const db = getDb()!;
  // FR-005 — deleting a training item never touches the source recording; we only
  // remove the item row (progress cascades). Uploaded media/documents are left in
  // S3 (orphan cleanup is out of scope for v1).
  await db.delete(trainingitems).where(eq(trainingitems.id, item.id));
}

// ── Media resolution (T004/T005 — FR-004/006/007) ────────────────────────────────

/** The S3 key backing a playable/viewable item, or null. */
async function itemMediaKey(item: TrainingItemRow): Promise<string | null> {
  if (item.type === "video") return item.mediakey;
  if (item.type === "document") return item.documentkey;
  // recording: resolve the referenced (non-deleted) recording's S3 object.
  if (!item.presentationrecordingid) return null;
  const db = getDb();
  if (!db) return null;
  const [rec] = await db
    .select({ mediaurl: presentationrecordings.mediaurl })
    .from(presentationrecordings)
    .where(
      and(
        eq(presentationrecordings.id, item.presentationrecordingid),
        isNull(presentationrecordings.deletedat),
      ),
    )
    .limit(1);
  return rec?.mediaurl ?? null;
}

/**
 * FR-004/006 — a playback URL for a video item (recording ref OR upload), access-
 * scoped by the course's space. Returns the same shape as the spec 071 replay so
 * the reused `ReplayPlayer` consumes it unchanged.
 */
export async function getItemPlayback(
  itemid: string,
  userid: string,
): Promise<{ status: "ready" | "none"; playbackUrl: string | null; kind: TrainingItemType }> {
  const item = await loadItemForViewer(itemid, userid);
  const key = await itemMediaKey(item);
  if (!key || !storageConfigured()) return { status: "none", playbackUrl: null, kind: item.type };
  const playbackUrl = await presignGet(key).catch(() => null);
  return { status: playbackUrl ? "ready" : "none", playbackUrl, kind: item.type };
}

/** A 7-day shareable/download link for an item's media (access-scoped). */
export async function getItemShareLink(itemid: string, userid: string): Promise<{ url: string | null }> {
  const item = await loadItemForViewer(itemid, userid);
  const key = await itemMediaKey(item);
  if (!key || !storageConfigured()) return { url: null };
  const downloadName = item.title.replace(/[^\w.-]+/g, "-").slice(0, 60) || "training";
  const url = await presignShare(key, { downloadName }).catch(() => null);
  return { url };
}

// ── Uploads (T003 — standalone video + document; FR-006/007) ─────────────────────

/**
 * Mint a presigned PUT URL so the browser uploads a training video/document
 * DIRECTLY to S3 (bytes never transit the app server → no memory/size limit on
 * our side). Author-gated by course. The client PUTs the file with the returned
 * `contentType`, then calls `addItem` with the returned `key`.
 */
export async function createTrainingUploadUrl(
  courseid: string,
  userid: string,
  file: { filename: string; contentType: string },
  kind: "video" | "document",
): Promise<{ key: string; url: string; contentType: string }> {
  await assertCourseAuthor(courseid, userid);
  if (!storageConfigured()) throw new EngineError("storage_unconfigured", 503);
  const safe = file.filename.replace(/[^\w.-]+/g, "-").slice(0, 80) || kind;
  const key = `training/${courseid}/${kind}/${uuidv7()}-${safe}`;
  const url = await presignPut(key, file.contentType);
  return { key, url, contentType: file.contentType };
}

// ── Progress (T006 — FR-009) ─────────────────────────────────────────────────────

/** Mark an item complete for the caller. Idempotent (unique itemid+userid). */
export async function markComplete(itemid: string, userid: string): Promise<void> {
  await loadItemForViewer(itemid, userid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await db
    .insert(trainingprogress)
    .values({ id: uuidv7(), itemid, userid })
    .onConflictDoNothing({ target: [trainingprogress.itemid, trainingprogress.userid] });
}

/** Un-mark an item for the caller. */
export async function unmarkComplete(itemid: string, userid: string): Promise<void> {
  await loadItemForViewer(itemid, userid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await db
    .delete(trainingprogress)
    .where(and(eq(trainingprogress.itemid, itemid), eq(trainingprogress.userid, userid)));
}
