import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { conversations, conversationmembers } from "../db/engine-schema";
import {
  remotecontrolaudit,
  remotecontrolsessions,
  type RemoteControlAuditRow,
  type RemoteControlSessionRow,
} from "../db/remotecontrol-schema";
import { EngineError } from "../engine/errors";
import { generateToken, hashToken } from "../auth/crypto";
import { ACTIVE_STATUSES, END_EVENT, type EndReason } from "./state";
import { publishControlStatus } from "./realtime";

/** Emit the current session snapshot to both participants (fire-and-forget). */
async function emit(sessionid: string): Promise<void> {
  const s = await getSession(sessionid);
  if (s) void publishControlStatus(s);
}

/**
 * Spec 088 — Remote Screen Control in DMs: the control-session state machine +
 * single-use agent token. This module is the security core; the API routes
 * (consent) and the WS control scope (transport) call into it.
 *
 * Lifecycle: requested → agent_pending (host allowed, token minted) → granted
 * (agent registered, control live) ↔ paused → ended (stop/panic/decline/drop).
 * Invariants: control is P2P/DM-only; the host must Allow before a token exists;
 * the token is single-use (hash stored, cleared on register/end); every
 * transition is audited; anything abnormal ends the session (fail-closed).
 */

// The helper agent must register within this window after the host allows.
const TOKEN_TTL_MS = 5 * 60_000;

function db() {
  const d = getDb();
  if (!d) throw new EngineError("db_unavailable", 503);
  return d;
}

async function audit(
  sessionid: string,
  event: RemoteControlAuditRow["event"],
  actoruserid: string | null,
  payload?: unknown,
): Promise<void> {
  await db()
    .insert(remotecontrolaudit)
    .values({ id: uuidv7(), sessionid, event, actoruserid, payload: payload ?? null });
}

/**
 * Resolve the other participant of a **1:1 `person` DM**, asserting `userid` is
 * one of exactly two members. Throws if the conversation isn't a 2-party person
 * DM the user belongs to — control is P2P-only (FR-002 trust boundary).
 */
async function resolveDmPeer(dmconversationid: string, userid: string): Promise<string> {
  const [conv] = await db()
    .select({ kind: conversations.kind })
    .from(conversations)
    .where(eq(conversations.id, dmconversationid))
    .limit(1);
  if (!conv) throw new EngineError("conversation_not_found", 404);
  if (conv.kind !== "person") throw new EngineError("not_a_dm", 400);

  const members = await db()
    .select({ userid: conversationmembers.userid })
    .from(conversationmembers)
    .where(eq(conversationmembers.conversationid, dmconversationid));
  if (!members.some((m) => m.userid === userid)) throw new EngineError("not_a_member", 403);
  if (members.length !== 2) throw new EngineError("not_a_dm", 400);
  return members.find((m) => m.userid !== userid)!.userid;
}

/**
 * FR-003 — controller asks to control the other party's screen. Ends any prior
 * still-active session in the same DM (one at a time), creates a fresh
 * `requested` session, and audits it. Returns the new session.
 */
export async function requestControl(
  dmconversationid: string,
  controlleruserid: string,
): Promise<RemoteControlSessionRow> {
  const hostuserid = await resolveDmPeer(dmconversationid, controlleruserid);

  // Supersede any lingering active session for this DM (fail-closed hygiene).
  const stale = await db()
    .select({ id: remotecontrolsessions.id })
    .from(remotecontrolsessions)
    .where(
      and(
        eq(remotecontrolsessions.dmconversationid, dmconversationid),
        inArray(remotecontrolsessions.status, ACTIVE_STATUSES),
      ),
    );
  for (const s of stale) await endControl(s.id, controlleruserid, "disconnected").catch(() => {});

  const [row] = await db()
    .insert(remotecontrolsessions)
    .values({ id: uuidv7(), dmconversationid, controlleruserid, hostuserid, status: "requested" })
    .returning();
  await audit(row.id, "requested", controlleruserid);
  void publishControlStatus(row);
  return row;
}

/** Load a session and assert `userid` is one of its two participants. */
export async function getParticipantSession(
  sessionid: string,
  userid: string,
): Promise<RemoteControlSessionRow> {
  const [row] = await db().select().from(remotecontrolsessions).where(eq(remotecontrolsessions.id, sessionid)).limit(1);
  if (!row) throw new EngineError("session_not_found", 404);
  if (row.controlleruserid !== userid && row.hostuserid !== userid) {
    throw new EngineError("forbidden", 403);
  }
  return row;
}

/**
 * FR-003/006 — the **host** consents. Mints a single-use token (only its hash is
 * stored), moves the session to `agent_pending`, and returns the raw token for
 * embedding in the agent download. Only the host may allow, only from `requested`.
 */
export async function allowControl(
  sessionid: string,
  hostuserid: string,
): Promise<{ session: RemoteControlSessionRow; token: string }> {
  const row = await getParticipantSession(sessionid, hostuserid);
  if (row.hostuserid !== hostuserid) throw new EngineError("only_host_may_allow", 403);
  if (row.status !== "requested") throw new EngineError("invalid_state", 409);

  const token = generateToken();
  const [updated] = await db()
    .update(remotecontrolsessions)
    .set({
      status: "agent_pending",
      tokenhash: hashToken(token),
      tokenexpiresat: new Date(Date.now() + TOKEN_TTL_MS),
      updatedat: new Date(),
    })
    .where(eq(remotecontrolsessions.id, sessionid))
    .returning();
  await audit(sessionid, "allowed", hostuserid);
  void publishControlStatus(updated);
  return { session: updated, token };
}

/** FR-003 — the host declines; the session ends with no token ever minted. */
export async function declineControl(sessionid: string, hostuserid: string): Promise<void> {
  const row = await getParticipantSession(sessionid, hostuserid);
  if (row.hostuserid !== hostuserid) throw new EngineError("only_host_may_decline", 403);
  if (row.status !== "requested") throw new EngineError("invalid_state", 409);
  await endControl(sessionid, hostuserid, "declined");
}

/**
 * FR-006 — the helper agent presents its single-use token over the WS control
 * scope. Validates it against an `agent_pending`, unexpired session, then grants
 * control (`granted`, `startedat`) and **consumes** the token (hash cleared so it
 * cannot be reused). Returns the session, or null on any mismatch (fail-closed).
 */
export async function registerAgent(rawtoken: string): Promise<RemoteControlSessionRow | null> {
  if (!rawtoken) return null;
  const [row] = await db()
    .select()
    .from(remotecontrolsessions)
    .where(and(eq(remotecontrolsessions.tokenhash, hashToken(rawtoken)), eq(remotecontrolsessions.status, "agent_pending")))
    .limit(1);
  if (!row) return null;
  if (!row.tokenexpiresat || row.tokenexpiresat.getTime() < Date.now()) {
    await endControl(row.id, null, "disconnected").catch(() => {});
    return null;
  }
  const [granted] = await db()
    .update(remotecontrolsessions)
    .set({ status: "granted", startedat: new Date(), tokenhash: null, tokenexpiresat: null, updatedat: new Date() })
    .where(eq(remotecontrolsessions.id, row.id))
    .returning();
  await audit(row.id, "agent_registered", null);
  await audit(row.id, "granted", null);
  void publishControlStatus(granted);
  return granted;
}

/** FR-011 — host's local input reclaims control: granted → paused. */
export async function pauseControl(sessionid: string, actoruserid: string | null): Promise<void> {
  const res = await db()
    .update(remotecontrolsessions)
    .set({ status: "paused", updatedat: new Date() })
    .where(and(eq(remotecontrolsessions.id, sessionid), eq(remotecontrolsessions.status, "granted")))
    .returning({ id: remotecontrolsessions.id });
  if (res.length) {
    await audit(sessionid, "paused", actoruserid);
    await emit(sessionid);
  }
}

/** paused → granted when the host stops touching their own input. */
export async function resumeControl(sessionid: string, actoruserid: string | null): Promise<void> {
  const res = await db()
    .update(remotecontrolsessions)
    .set({ status: "granted", updatedat: new Date() })
    .where(and(eq(remotecontrolsessions.id, sessionid), eq(remotecontrolsessions.status, "paused")))
    .returning({ id: remotecontrolsessions.id });
  if (res.length) {
    await audit(sessionid, "resumed", actoruserid);
    await emit(sessionid);
  }
}

/**
 * FR-010/012 — end a session (Stop button, panic hotkey, decline, or any
 * disconnect). Idempotent: a no-op if already ended. Clears the token so no
 * agent can (re)authenticate against a dead session (fail-closed).
 */
export async function endControl(
  sessionid: string,
  actoruserid: string | null,
  reason: EndReason,
): Promise<void> {
  const res = await db()
    .update(remotecontrolsessions)
    .set({ status: "ended", endedat: new Date(), endreason: reason, tokenhash: null, tokenexpiresat: null, updatedat: new Date() })
    .where(and(eq(remotecontrolsessions.id, sessionid), ne(remotecontrolsessions.status, "ended")))
    .returning({ id: remotecontrolsessions.id });
  if (res.length) {
    await audit(sessionid, END_EVENT[reason], actoruserid);
    await emit(sessionid);
  }
}

/** Current session row (no authz — internal/WS use). */
export async function getSession(sessionid: string): Promise<RemoteControlSessionRow | null> {
  const [row] = await db().select().from(remotecontrolsessions).where(eq(remotecontrolsessions.id, sessionid)).limit(1);
  return row ?? null;
}

/** FR-014 — audit history for a DM's control sessions (both participants may view). */
export async function listDmControlSessions(
  dmconversationid: string,
  userid: string,
): Promise<RemoteControlSessionRow[]> {
  await resolveDmPeer(dmconversationid, userid); // asserts membership
  return db()
    .select()
    .from(remotecontrolsessions)
    .where(eq(remotecontrolsessions.dmconversationid, dmconversationid))
    .orderBy(desc(remotecontrolsessions.createdat))
    .limit(50);
}

/** Audit rows for one session (participants only). */
export async function listSessionAudit(sessionid: string, userid: string): Promise<RemoteControlAuditRow[]> {
  await getParticipantSession(sessionid, userid); // asserts participant
  return db()
    .select()
    .from(remotecontrolaudit)
    .where(eq(remotecontrolaudit.sessionid, sessionid))
    .orderBy(remotecontrolaudit.at);
}
