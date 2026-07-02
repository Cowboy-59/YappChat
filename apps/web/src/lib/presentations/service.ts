import { and, count, desc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { communitymembers } from "../db/communities-schema";
import {
  presentationattendees,
  presentationcaptions,
  presentationchatmessages,
  presentationinvites,
  presentations,
  presentationrecordings,
  type PresentationAttendeeRow,
  type PresentationCaptionRow,
  type PresentationInviteRow,
  type PresentationRecordingRow,
  type PresentationRow,
  type PresentationVisibility,
} from "../db/presentations-schema";
import { generateToken, hashToken } from "../auth/crypto";
import {
  publishCaption,
  publishChat,
  publishHandRaised,
  publishHandResolved,
  publishParticipantJoined,
  publishParticipantLeft,
  publishPresentationStatus,
} from "./realtime";
import { summarizeChat, transcribeAudio, translateText } from "./captions";
import { closeRoom, getEgressInfo, normalizeS3Key, startRoomEgress } from "./livekit";
import { presignGet, storageConfigured } from "../storage/s3";
import { EngineError } from "../engine/errors";

/**
 * Spec 071 (Presentation) T002 — scheduling + calendar service.
 *
 * A host schedules a presentation and owns it (host = `users.id`). Listing is
 * access-filtered: a viewer sees their own presentations, all `public` ones, and
 * `private` ones attached to a community they belong to. Per-invite private
 * access (a shareable/targeted link) is resolved by T003 (invitations); this
 * task only covers ownership + public + community-member visibility.
 */

// Spec 071 v1 hard cap (FR-007). Schedules may request fewer, never more.
export const MAX_ATTENDEES_CAP = 100;

async function loadPresentation(id: string): Promise<PresentationRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(presentations).where(eq(presentations.id, id)).limit(1);
  if (!row) throw new EngineError("presentation_not_found", 404);
  return row;
}

async function isCommunityMember(communityid: string, userid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [m] = await db
    .select({ id: communitymembers.id })
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, userid)))
    .limit(1);
  return Boolean(m);
}

function assertScheduleOrder(start: Date, end: Date | null | undefined): void {
  if (end && end.getTime() <= start.getTime()) {
    throw new EngineError("invalid_schedule", 422, "scheduledend must be after scheduledstart");
  }
}

export interface CreatePresentationInput {
  title: string;
  description?: string;
  coverimageurl?: string | null;
  visibility?: PresentationVisibility;
  communityid?: string | null;
  spokenlanguage?: string;
  scheduledstart: Date;
  scheduledend?: Date | null;
  maxattendees?: number;
}

export async function createPresentation(
  input: CreatePresentationInput,
  hostuserid: string,
): Promise<PresentationRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  assertScheduleOrder(input.scheduledstart, input.scheduledend);
  // Attaching to a community requires membership (FR-006 access derives from it).
  if (input.communityid && !(await isCommunityMember(input.communityid, hostuserid))) {
    throw new EngineError("not_community_member", 403, "must belong to the community to attach a presentation");
  }

  const id = uuidv7();
  await db.insert(presentations).values({
    id,
    hostuserid,
    title: input.title,
    description: input.description ?? "",
    coverimageurl: input.coverimageurl ?? null,
    visibility: input.visibility ?? "private",
    communityid: input.communityid ?? null,
    spokenlanguage: input.spokenlanguage ?? "en",
    scheduledstart: input.scheduledstart,
    scheduledend: input.scheduledend ?? null,
    maxattendees: Math.min(input.maxattendees ?? MAX_ATTENDEES_CAP, MAX_ATTENDEES_CAP),
    status: "scheduled",
  });
  return loadPresentation(id);
}

/** A presentation the viewer is allowed to see; canceled ones are hidden from non-hosts. */
export async function getPresentationForViewer(id: string, viewerid: string): Promise<PresentationRow> {
  const row = await loadPresentation(id);
  if (row.hostuserid === viewerid) return row;
  // A canceled presentation is invisible to everyone but its host.
  if (row.status === "canceled") throw new EngineError("presentation_not_found", 404);
  if (row.visibility === "public") return row;
  if (row.communityid && (await isCommunityMember(row.communityid, viewerid))) return row;
  // Private + not host/community-member: invite-based access is resolved in T003.
  throw new EngineError("forbidden", 403);
}

export interface UpdatePresentationInput {
  title?: string;
  description?: string;
  coverimageurl?: string | null;
  visibility?: PresentationVisibility;
  communityid?: string | null;
  spokenlanguage?: string;
  scheduledstart?: Date;
  scheduledend?: Date | null;
  maxattendees?: number;
}

/** Edit a presentation — host only, and only while still `scheduled` (FR-003). */
export async function updatePresentation(
  id: string,
  patch: UpdatePresentationInput,
  actorid: string,
): Promise<PresentationRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const row = await loadPresentation(id);
  if (row.hostuserid !== actorid) throw new EngineError("not_host", 403);
  if (row.status !== "scheduled") {
    throw new EngineError("not_editable", 409, "only a scheduled presentation can be edited");
  }

  const start = patch.scheduledstart ?? row.scheduledstart;
  const end = patch.scheduledend === undefined ? row.scheduledend : patch.scheduledend;
  assertScheduleOrder(start, end);

  if (patch.communityid && !(await isCommunityMember(patch.communityid, actorid))) {
    throw new EngineError("not_community_member", 403, "must belong to the community to attach a presentation");
  }

  const set = { ...patch, updatedat: new Date() };
  if (set.maxattendees !== undefined) set.maxattendees = Math.min(set.maxattendees, MAX_ATTENDEES_CAP);
  await db.update(presentations).set(set).where(eq(presentations.id, id));
  return loadPresentation(id);
}

/** Cancel a presentation — host only; an already-ended one cannot be canceled. */
export async function cancelPresentation(id: string, actorid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const row = await loadPresentation(id);
  if (row.hostuserid !== actorid) throw new EngineError("not_host", 403);
  if (row.status === "ended") throw new EngineError("already_ended", 409);
  await db
    .update(presentations)
    .set({ status: "canceled", updatedat: new Date() })
    .where(eq(presentations.id, id));
}

// ── Host live controls (T005 — FR-009) ──────────────────────────────────────────

/** Host opens the room: status → live (idempotent if already live). */
export async function startPresentation(id: string, actorid: string): Promise<PresentationRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(id);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  if (p.status === "ended" || p.status === "canceled") {
    throw new EngineError("invalid_state", 409, `cannot start a ${p.status} presentation`);
  }
  if (p.status !== "live") {
    await db
      .update(presentations)
      .set({ status: "live", startedat: p.startedat ?? new Date(), updatedat: new Date() })
      .where(eq(presentations.id, id));
    await publishPresentationStatus(id, "live");
    // FR-023 — begin recording egress and CAPTURE the outcome (id or error) so the
    // host indicator reflects reality and we can pull the file on End.
    const { egressId, error } = await startRoomEgress(id);
    await db
      .update(presentations)
      .set({
        egressid: egressId,
        egressstatus: error ? "failed" : egressId ? "active" : null,
        egresserror: error,
        updatedat: new Date(),
      })
      .where(eq(presentations.id, id));
  }
  return loadPresentation(id);
}

/** Host ends the room: status → ended (idempotent), terminal. Recording is finalized in T008. */
export async function endPresentation(id: string, actorid: string): Promise<PresentationRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(id);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  if (p.status === "canceled") throw new EngineError("invalid_state", 409, "cannot end a canceled presentation");
  if (p.status === "ended") return p;
  await db
    .update(presentations)
    .set({ status: "ended", endedat: new Date(), updatedat: new Date() })
    .where(eq(presentations.id, id));
  await publishPresentationStatus(id, "ended");
  // Close the LiveKit room (disconnects everyone, finalizes egress). Best-effort.
  await closeRoom(id);
  // FR-023 — take control of the result: actively pull the finished egress file
  // instead of waiting for the webhook. Best-effort + idempotent (dedup on
  // egressid), so the webhook, if it also fires, won't create a duplicate.
  await finalizeRecordingFromEgress(id).catch((err) =>
    console.error("[presentations] finalizeRecordingFromEgress failed:", (err as Error).message),
  );
  return loadPresentation(id);
}

/**
 * FR-023 — pull the room's finished egress via ListEgress and register the
 * recording. Runs on End (primary) and can be re-run safely (idempotent). Marks
 * the presentation's egressstatus so the host indicator can settle.
 */
export async function finalizeRecordingFromEgress(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const p = await loadPresentation(id);
  const info = await getEgressInfo(id, p.egressid);
  if (!info) return;
  if (info.fileKey) {
    await registerRecording(id, { mediaurl: info.fileKey, durationms: info.durationms, egressid: p.egressid ?? undefined });
  }
  const settled = info.status === "EGRESS_COMPLETE" ? "ended" : info.status === "EGRESS_FAILED" || info.status === "EGRESS_ABORTED" ? "failed" : p.egressstatus;
  await db
    .update(presentations)
    .set({ egressstatus: settled, egresserror: info.error ?? p.egresserror, updatedat: new Date() })
    .where(eq(presentations.id, id));
}

// ── Recording + replay (T008 — FR-018/019/020/022) ──────────────────────────────

/**
 * Register a finished recording. Called by BOTH the pull-on-End path and the
 * LiveKit egress webhook, so it is idempotent by `egressid`: a second call for
 * the same egress returns the existing row instead of inserting a duplicate.
 * `mediaurl` is normalized to a bare S3 key so replay's presign always resolves.
 */
export async function registerRecording(
  presentationid: string,
  input: { mediaurl: string; durationms?: number | null; egressid?: string },
): Promise<PresentationRecordingRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await loadPresentation(presentationid); // 404 if the presentation is gone

  if (input.egressid) {
    const [existing] = await db
      .select()
      .from(presentationrecordings)
      .where(eq(presentationrecordings.egressid, input.egressid))
      .limit(1);
    if (existing) {
      // A later pull/webhook may carry the FINAL duration (the first register can
      // land before egress reports it → 0). Backfill it without creating a dup.
      if (input.durationms && input.durationms > 0 && !existing.durationms) {
        await db
          .update(presentationrecordings)
          .set({ durationms: input.durationms })
          .where(eq(presentationrecordings.id, existing.id));
        return { ...existing, durationms: input.durationms };
      }
      return existing;
    }
  }

  const id = uuidv7();
  await db.insert(presentationrecordings).values({
    id,
    presentationid,
    mediaurl: normalizeS3Key(input.mediaurl),
    egressid: input.egressid ?? null,
    durationms: input.durationms ?? null,
    status: "ready",
  });
  const [row] = await db.select().from(presentationrecordings).where(eq(presentationrecordings.id, id)).limit(1);
  return row;
}

/** FR-023 — host-only egress status for the in-room recording indicator. */
export async function egressStatusFor(
  presentationid: string,
  actorid: string,
): Promise<{ egressstatus: string | null; egressid: string | null; egresserror: string | null; startedat: string | null }> {
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  return {
    egressstatus: p.egressstatus ?? null,
    egressid: p.egressid ?? null,
    egresserror: p.egresserror ?? null,
    startedat: p.startedat ? p.startedat.toISOString() : null,
  };
}

/**
 * Access-scoped replay (FR-019): the latest ready, non-deleted recording plus a
 * short-lived presigned playback/download URL. Same view access as the live
 * session (host/public/community); invite-only attendees are not covered in v1.
 */
export async function getReplay(
  presentationid: string,
  viewerid: string | null,
): Promise<{
  status: "ready" | "processing" | "none";
  playbackUrl: string | null;
  recording?: { id: string; durationms: number | null; createdat: Date };
}> {
  await assertCanViewPresentation(presentationid, viewerid);
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const findReady = async () =>
    (
      await db
        .select()
        .from(presentationrecordings)
        .where(
          and(
            eq(presentationrecordings.presentationid, presentationid),
            eq(presentationrecordings.status, "ready"),
            isNull(presentationrecordings.deletedat),
          ),
        )
        .orderBy(desc(presentationrecordings.createdat))
        .limit(1)
    )[0];

  let rec = await findReady();
  if (!rec) {
    // Egress is likely still finalizing/uploading — pull it now (registers the file
    // once LiveKit reports COMPLETE), then re-check. Idempotent + best-effort.
    await finalizeRecordingFromEgress(presentationid).catch(() => {});
    rec = await findReady();
  }
  if (rec) {
    const playbackUrl = storageConfigured() ? await presignGet(rec.mediaurl).catch(() => null) : null;
    return { status: "ready", playbackUrl, recording: { id: rec.id, durationms: rec.durationms, createdat: rec.createdat } };
  }

  // No recording yet. If egress started and hasn't failed, one is still coming
  // (client shows "Processing…" and polls); otherwise there's genuinely none.
  const p = await loadPresentation(presentationid);
  const stillComing = Boolean(p.egressid) && p.egressstatus !== "failed";
  return { status: stillComing ? "processing" : "none", playbackUrl: null };
}

/** Host deletes a recording — soft delete; no longer playable, downloadable, or listed. */
export async function deleteRecording(presentationid: string, recordingid: string, actorid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  await db
    .update(presentationrecordings)
    .set({ deletedat: new Date() })
    .where(and(eq(presentationrecordings.id, recordingid), eq(presentationrecordings.presentationid, presentationid)));
}

// ── Captions (T006 — FR-014..017) ───────────────────────────────────────────────

/** A presentation the viewer may see; signed-in via full rules, guests only public. */
export async function assertCanViewPresentation(id: string, userid: string | null): Promise<PresentationRow> {
  if (userid != null) return getPresentationForViewer(id, userid);
  const p = await loadPresentation(id);
  if (p.visibility === "public" && p.status !== "canceled") return p;
  throw new EngineError("auth_required", 401, "sign in to access this presentation");
}

/** Store + broadcast a base-language caption line (host only). */
export async function ingestCaption(
  presentationid: string,
  line: { language?: string; text: string; offsetms?: number | null },
  actorid: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  if (!line.text.trim()) return;
  const language = line.language ?? p.spokenlanguage;
  await db.insert(presentationcaptions).values({
    id: uuidv7(),
    presentationid,
    language,
    text: line.text,
    offsetms: line.offsetms ?? null,
  });
  await publishCaption(presentationid, { language, text: line.text, offsetms: line.offsetms ?? null });
}

/** Transcribe one audio chunk (GROQ Whisper) in the presentation's spoken language, then ingest. */
export async function transcribeAndIngest(
  presentationid: string,
  audio: Blob,
  offsetms: number | null,
  actorid: string,
): Promise<{ text: string }> {
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  const text = await transcribeAudio(audio, p.spokenlanguage);
  if (text) await ingestCaption(presentationid, { language: p.spokenlanguage, text, offsetms }, actorid);
  return { text };
}

/** Translate a caption line for a viewer; `from` defaults to the presentation's spoken language. */
export async function translateCaption(
  presentationid: string,
  viewerid: string | null,
  input: { text: string; to: string; from?: string },
): Promise<{ translated: string }> {
  const p = await assertCanViewPresentation(presentationid, viewerid);
  const translated = await translateText(input.text, input.from ?? p.spokenlanguage, input.to);
  return { translated };
}

/** All stored caption lines for replay/caption sync, access-filtered, in order. */
export async function listCaptions(presentationid: string, viewerid: string | null): Promise<PresentationCaptionRow[]> {
  await assertCanViewPresentation(presentationid, viewerid);
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(presentationcaptions)
    .where(eq(presentationcaptions.presentationid, presentationid))
    .orderBy(presentationcaptions.offsetms, presentationcaptions.createdat);
}

// ── Chat + raise-hand (T007 — FR-011/012/013) ───────────────────────────────────

/**
 * Send an in-session chat message. v1 chat is delivered live over the videoroom
 * scope (signed-in) + the LiveKit data channel (guests, client-side); persistent
 * spec-001-backed history is a later enhancement.
 */
export async function sendChat(
  presentationid: string,
  sender: { userid: string | null; name: string },
  text: string,
): Promise<void> {
  await assertCanViewPresentation(presentationid, sender.userid);
  const body = text.trim();
  if (!body) return;
  // FR-028 — persist for the replay transcript/summary (best-effort), then publish live.
  const db = getDb();
  if (db) {
    await db
      .insert(presentationchatmessages)
      .values({ id: uuidv7(), presentationid, userid: sender.userid, name: sender.name, text: body })
      .catch(() => {});
  }
  await publishChat(presentationid, { fromuserid: sender.userid, fromname: sender.name, text: body });
}

/** FR-028 — the saved chat transcript for a presentation (access-scoped), oldest first. */
export async function listPresentationChat(
  presentationid: string,
  viewerid: string | null,
): Promise<Array<{ name: string; text: string; createdat: string }>> {
  await assertCanViewPresentation(presentationid, viewerid);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ name: presentationchatmessages.name, text: presentationchatmessages.text, createdat: presentationchatmessages.createdat })
    .from(presentationchatmessages)
    .where(eq(presentationchatmessages.presentationid, presentationid))
    .orderBy(presentationchatmessages.createdat);
  return rows.map((r) => ({ name: r.name, text: r.text, createdat: r.createdat.toISOString() }));
}

/** FR-028 — chat transcript + a short AI recap for the replay screen (access-scoped). */
export async function summarizePresentationChat(
  presentationid: string,
  viewerid: string | null,
): Promise<{ summary: string | null; count: number; messages: Array<{ name: string; text: string; createdat: string }> }> {
  const messages = await listPresentationChat(presentationid, viewerid);
  const summary = messages.length ? await summarizeChat(messages).catch(() => null) : null;
  return { summary, count: messages.length, messages };
}

async function findActiveAttendee(
  presentationid: string,
  by: { userid: string | null; attendeeid?: string },
): Promise<PresentationAttendeeRow | null> {
  const db = getDb();
  if (!db) return null;
  const where = by.attendeeid
    ? and(
        eq(presentationattendees.id, by.attendeeid),
        eq(presentationattendees.presentationid, presentationid),
        isNull(presentationattendees.leftat),
      )
    : by.userid != null
      ? and(
          eq(presentationattendees.presentationid, presentationid),
          eq(presentationattendees.userid, by.userid),
          isNull(presentationattendees.leftat),
        )
      : undefined;
  if (!where) return null;
  const [a] = await db.select().from(presentationattendees).where(where).limit(1);
  return a ?? null;
}

/** Raise the caller's hand — enters the host's ordered question queue (FR-012). */
export async function raiseHand(presentationid: string, by: { userid: string | null; attendeeid?: string }): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const a = await findActiveAttendee(presentationid, by);
  if (!a) throw new EngineError("attendee_not_found", 404);
  const now = new Date();
  await db
    .update(presentationattendees)
    .set({ handraisedat: now, handresolvedat: null })
    .where(eq(presentationattendees.id, a.id));
  await publishHandRaised(presentationid, {
    attendeeid: a.id,
    userid: a.userid,
    guestname: a.guestname,
    raisedat: now.toISOString(),
  });
}

/** Lower the caller's own hand. */
export async function lowerHand(presentationid: string, by: { userid: string | null; attendeeid?: string }): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const a = await findActiveAttendee(presentationid, by);
  if (!a) throw new EngineError("attendee_not_found", 404);
  await db
    .update(presentationattendees)
    .set({ handraisedat: null, handresolvedat: null })
    .where(eq(presentationattendees.id, a.id));
  await publishHandResolved(presentationid, a.id);
}

/** Host marks a queued question answered/dismissed (FR-013). */
export async function resolveHand(presentationid: string, attendeeid: string, actorid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  await db
    .update(presentationattendees)
    .set({ handresolvedat: new Date() })
    .where(and(eq(presentationattendees.id, attendeeid), eq(presentationattendees.presentationid, presentationid)));
  await publishHandResolved(presentationid, attendeeid);
}

export type QueueEntry = {
  attendeeid: string;
  userid: string | null;
  guestname: string | null;
  raisedat: Date | null;
};

/** The host's ordered, unresolved raise-hand queue. */
export async function listHandQueue(presentationid: string, actorid: string): Promise<QueueEntry[]> {
  const db = getDb();
  if (!db) return [];
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  return db
    .select({
      attendeeid: presentationattendees.id,
      userid: presentationattendees.userid,
      guestname: presentationattendees.guestname,
      raisedat: presentationattendees.handraisedat,
    })
    .from(presentationattendees)
    .where(
      and(
        eq(presentationattendees.presentationid, presentationid),
        isNotNull(presentationattendees.handraisedat),
        isNull(presentationattendees.handresolvedat),
        isNull(presentationattendees.leftat),
      ),
    )
    .orderBy(presentationattendees.handraisedat);
}

export type PresentationListItem = PresentationRow & { recordingid: string | null };

/**
 * Calendar feed: upcoming (scheduled/live) and past (ended) presentations the
 * viewer may see, newest-relevant first. Canceled presentations are excluded.
 * Past items carry the id of their (non-deleted) recording for replay, if any.
 */
export async function listPresentations(
  viewerid: string,
): Promise<{ upcoming: PresentationListItem[]; past: PresentationListItem[] }> {
  const db = getDb();
  if (!db) return { upcoming: [], past: [] };

  const myComm = await db
    .select({ cid: communitymembers.communityid })
    .from(communitymembers)
    .where(eq(communitymembers.userid, viewerid));
  const myCommIds = myComm.map((r) => r.cid);

  const visibility = or(
    eq(presentations.hostuserid, viewerid),
    eq(presentations.visibility, "public"),
    myCommIds.length
      ? and(eq(presentations.visibility, "private"), inArray(presentations.communityid, myCommIds))
      : undefined,
  )!;

  const rows = await db
    .select()
    .from(presentations)
    .where(and(ne(presentations.status, "canceled"), visibility))
    .orderBy(presentations.scheduledstart);

  const ids = rows.map((r) => r.id);
  const recs = ids.length
    ? await db
        .select({ presentationid: presentationrecordings.presentationid, id: presentationrecordings.id })
        .from(presentationrecordings)
        .where(and(inArray(presentationrecordings.presentationid, ids), isNull(presentationrecordings.deletedat)))
    : [];
  const recMap = new Map(recs.map((r) => [r.presentationid, r.id]));

  const items: PresentationListItem[] = rows.map((r) => ({ ...r, recordingid: recMap.get(r.id) ?? null }));
  const upcoming = items.filter((p) => p.status === "scheduled" || p.status === "live");
  // Past = ended sessions, most recent first.
  const past = items.filter((p) => p.status === "ended").reverse();
  return { upcoming, past };
}

// ── Invitations (T003) ─────────────────────────────────────────────────────────

export interface CreateInviteInput {
  kind: PresentationVisibility; // the access the link grants: public (guest-OK) | private (sign-in)
  inviteduserid?: string | null; // a targeted private invite; null = shareable link
  invitedemail?: string | null;
  expiresat?: Date | null;
}

/**
 * Mint an invite link for a presentation (host only). The plaintext token is
 * returned ONCE; only its sha-256 hash is stored (mirroring `communityinvites`).
 */
export async function createInvite(
  presentationid: string,
  input: CreateInviteInput,
  actorid: string,
): Promise<{ invite: PresentationInviteRow; token: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);

  const token = generateToken();
  const id = uuidv7();
  await db.insert(presentationinvites).values({
    id,
    presentationid,
    kind: input.kind,
    tokenhash: hashToken(token),
    inviteduserid: input.inviteduserid ?? null,
    invitedemail: input.invitedemail ?? null,
    createdby: actorid,
    expiresat: input.expiresat ?? null,
  });
  const [invite] = await db.select().from(presentationinvites).where(eq(presentationinvites.id, id)).limit(1);
  return { invite, token };
}

export type InviteSummary = {
  id: string;
  kind: PresentationVisibility;
  inviteduserid: string | null;
  invitedemail: string | null;
  expiresat: Date | null;
  revokedat: Date | null;
  createdat: Date;
};

/** Invites for a presentation (host only). The tokenhash is never exposed. */
export async function listInvites(presentationid: string, actorid: string): Promise<InviteSummary[]> {
  const db = getDb();
  if (!db) return [];
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  return db
    .select({
      id: presentationinvites.id,
      kind: presentationinvites.kind,
      inviteduserid: presentationinvites.inviteduserid,
      invitedemail: presentationinvites.invitedemail,
      expiresat: presentationinvites.expiresat,
      revokedat: presentationinvites.revokedat,
      createdat: presentationinvites.createdat,
    })
    .from(presentationinvites)
    .where(eq(presentationinvites.presentationid, presentationid))
    .orderBy(desc(presentationinvites.createdat));
}

/** Revoke an invite (host only); idempotent. */
export async function revokeInvite(presentationid: string, inviteid: string, actorid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(presentationid);
  if (p.hostuserid !== actorid) throw new EngineError("not_host", 403);
  const [inv] = await db
    .select({ id: presentationinvites.id, revokedat: presentationinvites.revokedat })
    .from(presentationinvites)
    .where(and(eq(presentationinvites.id, inviteid), eq(presentationinvites.presentationid, presentationid)))
    .limit(1);
  if (!inv) throw new EngineError("invite_not_found", 404);
  if (inv.revokedat) return;
  await db.update(presentationinvites).set({ revokedat: new Date() }).where(eq(presentationinvites.id, inviteid));
}

/** Resolve a plaintext token to a still-valid invite for a presentation, else null. */
async function resolveInvite(token: string, presentationid: string): Promise<PresentationInviteRow | null> {
  const db = getDb();
  if (!db) return null;
  const [inv] = await db
    .select()
    .from(presentationinvites)
    .where(and(eq(presentationinvites.tokenhash, hashToken(token)), eq(presentationinvites.presentationid, presentationid)))
    .limit(1);
  if (!inv || inv.revokedat) return null;
  if (inv.expiresat && inv.expiresat.getTime() < Date.now()) return null;
  return inv;
}

// ── Join / leave (T003 — FR-005/006/007) ───────────────────────────────────────

export interface JoinInput {
  userid: string | null; // session user, or null for an anonymous guest
  token?: string;
  guestname?: string;
}

/**
 * Admit a joiner to a presentation, enforcing visibility + capacity:
 *  - public: any signed-in user, or an anonymous guest who supplies a display name.
 *  - private: a signed-in user who is the host, a member of the attached community,
 *    or holds a valid (matching, unexpired, un-revoked) invite. Guests are refused.
 *  - capacity: the hard `maxattendees` cap (host excluded) → `room_full`.
 * Re-joining as the same signed-in user returns the existing active attendee row.
 */
export async function joinPresentation(
  presentationid: string,
  input: JoinInput,
): Promise<{ attendee: PresentationAttendeeRow; presentation: PresentationRow }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const p = await loadPresentation(presentationid);

  if (p.status === "canceled") throw new EngineError("presentation_not_found", 404);
  if (p.status === "ended") throw new EngineError("presentation_ended", 409, "this presentation has ended");

  const isHost = input.userid != null && input.userid === p.hostuserid;
  const role: "host" | "attendee" = isHost ? "host" : "attendee";

  if (!isHost) {
    if (p.visibility === "public") {
      // Anonymous guests must supply a display name (FR-005).
      if (input.userid == null && !input.guestname?.trim()) {
        throw new EngineError("guestname_required", 422, "a display name is required to join as a guest");
      }
    } else {
      // Private requires a signed-in account (FR-006); guests are refused.
      if (input.userid == null) throw new EngineError("auth_required", 401, "sign in to join a private presentation");
      const member = p.communityid ? await isCommunityMember(p.communityid, input.userid) : false;
      const invite = input.token ? await resolveInvite(input.token, presentationid) : null;
      const inviteOk = invite != null && (invite.inviteduserid == null || invite.inviteduserid === input.userid);
      if (!member && !inviteOk) throw new EngineError("forbidden", 403, "an invite is required to join this presentation");
    }
  }

  // Capacity cap (FR-007); the host never counts against it. Best-effort under
  // concurrency — a small over-admit is tolerated for v1.
  if (!isHost) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(presentationattendees)
      .where(
        and(
          eq(presentationattendees.presentationid, presentationid),
          eq(presentationattendees.role, "attendee"),
          isNull(presentationattendees.leftat),
        ),
      );
    if (Number(n) >= p.maxattendees) throw new EngineError("room_full", 409, "this presentation is at capacity");
  }

  // Idempotent re-join for a signed-in user with a still-active row.
  if (input.userid != null) {
    const [existing] = await db
      .select()
      .from(presentationattendees)
      .where(
        and(
          eq(presentationattendees.presentationid, presentationid),
          eq(presentationattendees.userid, input.userid),
          isNull(presentationattendees.leftat),
        ),
      )
      .limit(1);
    if (existing) return { attendee: existing, presentation: p };
  }

  const id = uuidv7();
  await db.insert(presentationattendees).values({
    id,
    presentationid,
    userid: input.userid ?? null,
    guestname: input.userid == null ? (input.guestname?.trim() ?? null) : null,
    role,
  });
  const [attendee] = await db.select().from(presentationattendees).where(eq(presentationattendees.id, id)).limit(1);
  await publishParticipantJoined(presentationid, {
    attendeeid: attendee.id,
    userid: attendee.userid,
    guestname: attendee.guestname,
    role: attendee.role,
  });
  return { attendee, presentation: p };
}

/** Mark a joiner as left. Signed-in users leave by identity; guests by attendee id. */
export async function leavePresentation(
  presentationid: string,
  input: { userid: string | null; attendeeid?: string },
): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  if (input.userid != null) {
    await db
      .update(presentationattendees)
      .set({ leftat: new Date() })
      .where(
        and(
          eq(presentationattendees.presentationid, presentationid),
          eq(presentationattendees.userid, input.userid),
          isNull(presentationattendees.leftat),
        ),
      );
    await publishParticipantLeft(presentationid, { userid: input.userid });
    return;
  }
  if (input.attendeeid) {
    await db
      .update(presentationattendees)
      .set({ leftat: new Date() })
      .where(
        and(
          eq(presentationattendees.id, input.attendeeid),
          eq(presentationattendees.presentationid, presentationid),
          isNull(presentationattendees.leftat),
        ),
      );
    await publishParticipantLeft(presentationid, { attendeeid: input.attendeeid, userid: null });
    return;
  }
  throw new EngineError("attendee_required", 422, "attendeeid is required to leave as a guest");
}
