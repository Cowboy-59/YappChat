/**
 * Spec 003 — standalone WebSocket Engine.
 *
 * Next.js App Router can't host a raw WS server, so this runs as its own Node
 * process (`pnpm ws`) sharing the same Postgres + session cookies as apps/web.
 *
 * Responsibilities (this build):
 *  - T001 authenticate from the `yc_session` cookie; `wssessions` registry;
 *    `connected` handshake; heartbeat_ack.
 *  - T002 scope subscriptions with authorization (user:self, org:member,
 *    broadcast, channel open; agent/videoroom/pairing deferred).
 *  - T003 event envelope + LocalBroker routing (RedisBroker still designed-in).
 *  - T004 WS ping/pong + app-level heartbeat dead-connection detection.
 *  - T005 replay log (`wsevents`, 5-min TTL) + resume handshake + cleanup job.
 *  - T006 presence (online/offline/in_call, in-memory) + typing indicators.
 *  - T007 capacity monitoring + 70/90% alerts + /stats.
 *  - internal HTTP seam (x-internal-secret): /publish /presence /stats /sessions.
 *
 * Deferred: RedisBroker; cross-spec subscribe authz (channel membership, agent,
 * videoroom, pairing); live PA-channel alert delivery (postPANotification —
 * spec 002 stub → console.error fallback).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
// The db client is lazy (connects on first getDb()), so importing it before the
// env IIFE runs is safe — no connection is opened at import time.
import { getDb } from "../lib/db/client";
import { sessions, users, orgmemberships } from "../lib/db/auth-schema";
import { conversationmembers } from "../lib/db/engine-schema";
import { communitymembers } from "../lib/db/communities-schema";
import { presentations, presentationattendees } from "../lib/db/presentations-schema";
import { remotecontrolsessions } from "../lib/db/remotecontrol-schema";
import { wssessions, wsevents } from "../lib/db/ws-schema";
import { hashToken } from "../lib/auth/crypto";
import { scopes, WSEventType, type PresenceStatus } from "../lib/ws/events";
import { endControl, pauseControl, registerAgent, resumeControl } from "../lib/remotecontrol/service";
import type { ClientMessage, ServerMessage, WSEvent } from "../lib/ws/events";
import { verifyWsToken } from "../lib/ws/token";
import { evaluateCapacity, initialCapacityState, type CapacityState } from "../lib/ws/capacity";

// Load .env.local into process.env BEFORE the first getDb() call (on connect).
(() => {
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../.env.local");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* env file optional */
  }
})();

// Safety net: a single WS engine serves ALL live connections, so an unhandled
// rejection/exception anywhere must NOT crash the process (it would drop every
// socket). Log and keep serving; individual failures are already handled inline.
process.on("unhandledRejection", (reason) => {
  console.error("[ws] unhandledRejection:", reason instanceof Error ? reason.message : String(reason));
});
process.on("uncaughtException", (err) => {
  console.error("[ws] uncaughtException:", err.message);
});

const WS_PORT = Number(process.env.WS_PORT ?? 3001);
const INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET ?? "dev-internal-secret";
const SESSION_COOKIE = "yc_session";
const MAX_CONNECTIONS = Number(process.env.WS_MAX_CONNECTIONS ?? 1000);
const EVENT_TTL_MS = 5 * 60_000; // 5-minute replay window
const TYPING_TIMEOUT_MS = 5_000;

type Client = {
  ws: WebSocket;
  sessionid: string;
  userid: string;
  subs: Set<string>;
  isAlive: boolean;
  /** serialize async message handling so subscribe can't be overtaken by resume */
  queue: Promise<void>;
  /** per-channel auto typing-stop timers */
  typingTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** Spec 088 — set when this connection is a control agent (not a user). */
  controlSessionId?: string;
};

const clients = new Map<WebSocket, Client>();
// Spec 088 — live control sessions: the connected agent + cached authz meta so
// the high-frequency input relay never touches the DB per event.
type ControlMeta = { controller: string; host: string; agent: Client; status: "granted" | "paused" };
const controlSessions = new Map<string, ControlMeta>();
const bySessionId = new Map<string, Client>();
/** userid -> live sessions (presence is online while this set is non-empty). */
const userSessions = new Map<string, Set<Client>>();
/** in-memory presence — NEVER persisted; rebuilt from reconnecting sessions. */
const presence = new Map<string, PresenceStatus>();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function validateSession(token: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ userid: sessions.userid })
    .from(sessions)
    .innerJoin(users, eq(sessions.userid, users.id))
    .where(
      and(
        eq(sessions.sessiontokenhash, hashToken(token)),
        isNull(sessions.revokedat),
        gt(sessions.expiresat, new Date()),
      ),
    )
    .limit(1);
  return row?.userid ?? null;
}

/** Org ids the user belongs to — used to scope presence broadcasts. */
async function getUserOrgIds(userid: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({ orgid: orgmemberships.orgid })
      .from(orgmemberships)
      .where(eq(orgmemberships.userid, userid));
    return rows.map((r) => r.orgid);
  } catch (err) {
    // A presence-scoping lookup must NEVER crash the engine: this runs in the
    // connect/disconnect path via `void`, so an unhandled rejection here would
    // SIGTERM the process and drop every live connection. Degrade to "no orgs".
    console.error("[ws] getUserOrgIds failed:", (err as Error).message);
    return [];
  }
}

/** Authorize a subscription request for the connected user. */
async function canSubscribe(userid: string, scope: string): Promise<boolean> {
  if (scope === scopes.broadcast) return true;
  if (scope === scopes.user(userid)) return true;
  if (scope.startsWith("org:")) {
    const orgid = scope.slice("org:".length);
    const db = getDb();
    if (!db) return false;
    const [m] = await db
      .select({ id: orgmemberships.id })
      .from(orgmemberships)
      .where(and(eq(orgmemberships.userid, userid), eq(orgmemberships.orgid, orgid)))
      .limit(1);
    return Boolean(m);
  }
  // Spec 001 (T009): conversation scope is membership-checked against
  // `conversationmembers` — the canonical native-message scope used by spec 017.
  if (scope.startsWith("conversation:")) {
    const conversationid = scope.slice("conversation:".length);
    const db = getDb();
    if (!db) return false;
    const [m] = await db
      .select({ id: conversationmembers.id })
      .from(conversationmembers)
      .where(
        and(
          eq(conversationmembers.userid, userid),
          eq(conversationmembers.conversationid, conversationid),
        ),
      )
      .limit(1);
    return Boolean(m);
  }
  // Spec 071 (Presentation T004): a signed-in user may subscribe to a
  // presentation's videoroom when they are the host, it is public, they hold an
  // active attendee row (admitted via the join API, which already enforced
  // access), or they belong to the attached community. Anonymous guests use the
  // LiveKit data channel instead (no yc_session → never reach this engine).
  if (scope.startsWith("videoroom:")) {
    const presentationid = scope.slice("videoroom:".length);
    const db = getDb();
    if (!db) return false;
    const [p] = await db
      .select({
        hostuserid: presentations.hostuserid,
        visibility: presentations.visibility,
        communityid: presentations.communityid,
      })
      .from(presentations)
      .where(eq(presentations.id, presentationid))
      .limit(1);
    if (!p) return false;
    if (p.hostuserid === userid) return true;
    if (p.visibility === "public") return true;
    const [a] = await db
      .select({ id: presentationattendees.id })
      .from(presentationattendees)
      .where(
        and(
          eq(presentationattendees.presentationid, presentationid),
          eq(presentationattendees.userid, userid),
          isNull(presentationattendees.leftat),
        ),
      )
      .limit(1);
    if (a) return true;
    if (p.communityid) {
      const [m] = await db
        .select({ id: communitymembers.id })
        .from(communitymembers)
        .where(and(eq(communitymembers.communityid, p.communityid), eq(communitymembers.userid, userid)))
        .limit(1);
      if (m) return true;
    }
    return false;
  }
  // Spec 088: a remote-control session scope is subscribable only by its two
  // participants (controller + host) — verified against the session row.
  if (scope.startsWith("remotecontrol:")) {
    const sessionid = scope.slice("remotecontrol:".length);
    const db = getDb();
    if (!db) return false;
    const [s] = await db
      .select({ controller: remotecontrolsessions.controlleruserid, host: remotecontrolsessions.hostuserid })
      .from(remotecontrolsessions)
      .where(eq(remotecontrolsessions.id, sessionid))
      .limit(1);
    return Boolean(s && (s.controller === userid || s.host === userid));
  }
  // Spec 001 (T2): the legacy channel scope stays open until the per-conversation
  // model fully supersedes it (FR-008/009). Other scopes (agent/pairing) deferred.
  if (scope.startsWith("channel:")) return true;
  return false;
}

// ── Event pipeline (T003 + T005) ─────────────────────────────────────────────
/** Deliver an event to all sessions whose subscriptions match its scope. */
function routeEvent(event: WSEvent): number {
  let delivered = 0;
  for (const client of clients.values()) {
    if (client.subs.has(event.scope)) {
      send(client.ws, { type: "event", event });
      delivered++;
    }
  }
  return delivered;
}

/** Persist an event into the replay log with a fixed 5-minute TTL. */
async function persistEvent(event: WSEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(wsevents).values({
      id: event.id,
      type: event.type,
      scope: event.scope,
      payload: event.payload ?? null,
      ts: event.ts,
      expiresat: new Date(event.ts + EVENT_TTL_MS),
    });
  } catch (err) {
    console.error("[ws] persistEvent failed:", (err as Error).message);
  }
}

/** Canonical publish: persist for replay, route to live subscribers. */
async function publish(event: WSEvent): Promise<number> {
  // Keep presence map roughly correct for the /presence fetch without coupling
  // the router to event meaning: only mirror presence.* events carrying a userid.
  if (event.type.startsWith("presence.")) {
    const uid = (event.payload as { userid?: string } | undefined)?.userid;
    if (uid) {
      if (event.type === WSEventType.PresenceOffline) presence.delete(uid);
      else presence.set(uid, event.type === WSEventType.PresenceInCall ? "in_call" : "online");
    }
  }
  await persistEvent(event);
  return routeEvent(event);
}

/** Build + publish an event from engine-internal sources (presence/typing). */
function emit(type: string, scope: string, payload?: unknown): Promise<number> {
  return publish({ id: uuidv7(), type, scope, payload, ts: Date.now() });
}

// ── Presence (T006) ──────────────────────────────────────────────────────────
async function onClientOnline(client: Client): Promise<void> {
  let set = userSessions.get(client.userid);
  if (!set) {
    set = new Set();
    userSessions.set(client.userid, set);
  }
  const wasOffline = set.size === 0;
  set.add(client);
  if (wasOffline) {
    presence.set(client.userid, "online");
    const orgIds = await getUserOrgIds(client.userid);
    for (const orgid of orgIds) {
      await emit(WSEventType.PresenceOnline, scopes.org(orgid), { userid: client.userid });
    }
  }
}

async function onClientOffline(client: Client): Promise<void> {
  const set = userSessions.get(client.userid);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) {
    userSessions.delete(client.userid);
    presence.delete(client.userid);
    const orgIds = await getUserOrgIds(client.userid);
    for (const orgid of orgIds) {
      await emit(WSEventType.PresenceOffline, scopes.org(orgid), { userid: client.userid });
    }
  }
}

/** Tear down a client fully — close socket, free state, update presence. */
async function removeClient(client: Client): Promise<void> {
  if (!clients.has(client.ws)) return; // already removed
  clients.delete(client.ws);
  bySessionId.delete(client.sessionid);
  for (const timer of client.typingTimers.values()) clearTimeout(timer);
  client.typingTimers.clear();
  // Spec 088 — a control agent dropping ends the session (fail-closed: no
  // standing access, no orphaned agent). Agents have no wssessions row/presence.
  if (client.controlSessionId) {
    const meta = controlSessions.get(client.controlSessionId);
    if (meta && meta.agent === client) controlSessions.delete(client.controlSessionId);
    await endControl(client.controlSessionId, null, "disconnected").catch(() => {});
    return;
  }
  const db = getDb();
  if (db) await db.delete(wssessions).where(eq(wssessions.id, client.sessionid)).catch(() => {});
  await onClientOffline(client);
}

/** Persist the cached subscription projection for a session (best-effort). */
async function syncSubs(client: Client): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(wssessions)
    .set({ subscriptions: [...client.subs] })
    .where(eq(wssessions.id, client.sessionid))
    .catch(() => {});
}

// ── Resume / replay (T005) ───────────────────────────────────────────────────
async function handleResume(client: Client, lastEventId: string): Promise<void> {
  const db = getDb();
  const subs = [...client.subs];
  if (!db || subs.length === 0) {
    send(client.ws, { type: "replay_unavailable", reason: "event_log_expired" });
    return;
  }
  // Newer, still-live events for this client's current subscriptions, in id order.
  const rows = await db
    .select({ id: wsevents.id, type: wsevents.type, scope: wsevents.scope, payload: wsevents.payload, ts: wsevents.ts })
    .from(wsevents)
    .where(
      and(
        gt(wsevents.id, lastEventId),
        gt(wsevents.expiresat, new Date()),
        inArray(wsevents.scope, subs),
      ),
    )
    .orderBy(wsevents.id);

  // Continuity check: if we can't find the cursor in the log AND there is nothing
  // newer to send, the client was gone longer than the TTL — force a full refresh.
  if (rows.length === 0) {
    const [anchor] = await db
      .select({ id: wsevents.id })
      .from(wsevents)
      .where(eq(wsevents.id, lastEventId))
      .limit(1);
    if (!anchor) {
      send(client.ws, { type: "replay_unavailable", reason: "event_log_expired" });
      return;
    }
  }

  send(client.ws, { type: "replay_start", count: rows.length });
  for (const r of rows) {
    send(client.ws, {
      type: "event",
      event: { id: r.id, type: r.type, scope: r.scope, payload: r.payload ?? undefined, ts: Number(r.ts) },
    });
  }
  send(client.ws, { type: "replay_end" });
}

// ── Typing (T006) ────────────────────────────────────────────────────────────
function stopTyping(client: Client, channelid: string): void {
  const timer = client.typingTimers.get(channelid);
  if (timer) {
    clearTimeout(timer);
    client.typingTimers.delete(channelid);
  }
  void emit(WSEventType.TypingStop, scopes.channel(channelid), { userid: client.userid, channelid });
}

function startTyping(client: Client, channelid: string): void {
  void emit(WSEventType.TypingStart, scopes.channel(channelid), { userid: client.userid, channelid });
  const existing = client.typingTimers.get(channelid);
  if (existing) clearTimeout(existing);
  client.typingTimers.set(
    channelid,
    setTimeout(() => stopTyping(client, channelid), TYPING_TIMEOUT_MS),
  );
}

// ── Message handling (serialized per connection) ─────────────────────────────
async function handleMessage(client: Client, raw: string): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    send(client.ws, { type: "error", error: "invalid_message" });
    return;
  }
  switch (msg.action) {
    case "ping":
      send(client.ws, { type: "pong" });
      break;
    case "heartbeat": {
      const db = getDb();
      if (db)
        await db
          .update(wssessions)
          .set({ lastheartbeat: new Date() })
          .where(eq(wssessions.id, client.sessionid))
          .catch(() => {});
      send(client.ws, { type: "heartbeat_ack" });
      break;
    }
    case "subscribe":
      if (await canSubscribe(client.userid, msg.scope)) {
        client.subs.add(msg.scope);
        await syncSubs(client);
        send(client.ws, { type: "subscribed", scope: msg.scope });
      } else {
        send(client.ws, { type: "error", error: `unauthorized_scope:${msg.scope}` });
      }
      break;
    case "unsubscribe":
      client.subs.delete(msg.scope);
      await syncSubs(client);
      send(client.ws, { type: "unsubscribed", scope: msg.scope });
      break;
    case "resume":
      await handleResume(client, msg.lastEventId);
      break;
    case "typing":
      startTyping(client, msg.channelid);
      break;
    case "typing_stop":
      stopTyping(client, msg.channelid);
      break;
    // Spec 088 — relay a controller's input to the session's agent. In-memory
    // authz (no DB per event): sender must be the controller, session granted
    // (not paused), agent connected. Anything else is silently dropped.
    case "control_input": {
      const meta = controlSessions.get(msg.sessionId);
      if (meta && meta.status === "granted" && meta.controller === client.userid) {
        send(meta.agent.ws, { type: "control_input", input: msg.input });
      }
      break;
    }
    // FR-011 — the host's own input reclaims control (pause); resume when idle.
    // The agent (which sees the host's physical input) or the host's browser may
    // signal this; both are authorized for the session.
    case "control_pause": {
      // Agents don't know their session id — resolve it from the connection.
      const sessionId = client.controlSessionId ?? msg.sessionId;
      const meta = controlSessions.get(sessionId);
      const fromHost = Boolean(meta && meta.host === client.userid);
      const fromAgent = Boolean(client.controlSessionId) && client.controlSessionId === sessionId;
      if (meta && (fromHost || fromAgent) && meta.status === "granted") {
        meta.status = "paused";
        void pauseControl(sessionId, fromHost ? client.userid : null);
      }
      break;
    }
    case "control_resume": {
      const sessionId = client.controlSessionId ?? msg.sessionId;
      const meta = controlSessions.get(sessionId);
      const fromHost = Boolean(meta && meta.host === client.userid);
      const fromAgent = Boolean(client.controlSessionId) && client.controlSessionId === sessionId;
      if (meta && (fromHost || fromAgent) && meta.status === "paused") {
        meta.status = "granted";
        void resumeControl(sessionId, fromHost ? client.userid : null);
      }
      break;
    }
  }
}

// ── Capacity monitoring + alerts (T007) ──────────────────────────────────────
let capacityState: CapacityState = initialCapacityState();
let lastAlertSentAt: string | null = null;

async function fireCapacityAlert(level: 70 | 90, current: number, pct: number): Promise<void> {
  const text =
    level === 90
      ? `🚨 WebSocket capacity critical — immediate action required. Active connections: ${current} of ${MAX_CONNECTIONS} (${pct}% of capacity). New connections may be refused soon.`
      : `⚠️ WebSocket capacity warning — action recommended. Active connections: ${current} of ${MAX_CONNECTIONS} (${pct}% of capacity). The WebSocket engine is approaching its single-process limit. Switch to the Redis broker to support horizontal scaling before connections are refused. To upgrade: set WS_BROKER=redis and REDIS_URL in the server environment and restart. No code changes required.`;
  lastAlertSentAt = new Date().toISOString();
  // Recipients: every system admin (spec 011 FR-009). Delivery seam is spec 002
  // `postPANotification` (still a stub) — fall back to console.error per spec.
  const db = getDb();
  let admins: { id: string }[] = [];
  if (db) admins = await db.select({ id: users.id }).from(users).where(eq(users.issystemadmin, true)).catch(() => []);
  // TODO(spec-002): postPANotification({ bypassQuietHours: true, callerscope: 'ws-capacity', recipients: admins }).
  console.error(`[ws][capacity] ${text} (recipients: ${admins.length} system admin(s))`);
}

function checkCapacity(): void {
  const current = clients.size;
  const pct = MAX_CONNECTIONS > 0 ? Math.round((current / MAX_CONNECTIONS) * 100) : 0;
  const { state, fire } = evaluateCapacity(pct, capacityState);
  capacityState = state;
  if (fire) void fireCapacityAlert(fire, current, pct);
}

// ── HTTP server: internal seam (publish/presence/stats/sessions) + health ─────
function requireSecret(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.headers["x-internal-secret"] !== INTERNAL_SECRET) {
    res.writeHead(401);
    res.end("unauthorized");
    return false;
  }
  return true;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${WS_PORT}`);
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") {
    json(res, 200, { ok: true, clients: clients.size });
    return;
  }

  if (req.method === "POST" && path === "/publish") {
    if (!requireSecret(req, res)) return;
    try {
      const event = JSON.parse(await readBody(req)) as WSEvent;
      const delivered = await publish(event);
      json(res, 200, { delivered });
    } catch {
      res.writeHead(400);
      res.end("bad request");
    }
    return;
  }

  if (req.method === "GET" && path === "/presence") {
    if (!requireSecret(req, res)) return;
    const orgid = url.searchParams.get("orgid");
    if (!orgid) {
      json(res, 400, { error: "orgid required" });
      return;
    }
    const db = getDb();
    const map: Record<string, PresenceStatus> = {};
    if (db) {
      const members = await db
        .select({ userid: orgmemberships.userid })
        .from(orgmemberships)
        .where(eq(orgmemberships.orgid, orgid));
      for (const m of members) {
        const status = presence.get(m.userid);
        if (status) map[m.userid] = status;
      }
    }
    json(res, 200, map);
    return;
  }

  if (req.method === "GET" && path === "/stats") {
    if (!requireSecret(req, res)) return;
    const current = clients.size;
    json(res, 200, {
      activeConnections: current,
      maxConnections: MAX_CONNECTIONS,
      pct: MAX_CONNECTIONS > 0 ? Math.round((current / MAX_CONNECTIONS) * 100) : 0,
      broker: "local",
      alertThreshold70Triggered: capacityState.triggered70,
      alertThreshold90Triggered: capacityState.triggered90,
      lastAlertSentAt,
    });
    return;
  }

  // DELETE /sessions/:id — force-close a live connection (admin, via Next proxy).
  if (req.method === "DELETE" && path.startsWith("/sessions/")) {
    if (!requireSecret(req, res)) return;
    const sessionid = decodeURIComponent(path.slice("/sessions/".length));
    const client = bySessionId.get(sessionid);
    if (!client) {
      json(res, 404, { error: "not found" });
      return;
    }
    client.ws.close(1000, "force_closed");
    await removeClient(client);
    json(res, 200, { closed: sessionid });
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server: httpServer });

/**
 * Spec 088 — a control helper agent connects with ?controltoken=… (a single-use
 * token minted when the host allowed control). We validate + consume it via
 * registerAgent (which grants the session), then hold the connection as the
 * input sink: force-subscribed to `remotecontrol:{sessionId}` (so it receives
 * paused/resumed/ended status and self-terminates), and registered in
 * `controlSessions` so the controller's input can be relayed to it directly.
 */
async function handleAgentConnection(ws: WebSocket, token: string): Promise<void> {
  const session = await registerAgent(token);
  if (!session) {
    send(ws, { type: "error", error: "invalid_control_token" });
    ws.close(4401, "invalid_control_token");
    return;
  }
  const sessionid = uuidv7();
  const client: Client = {
    ws,
    sessionid,
    userid: `agent:${session.id}`,
    subs: new Set([scopes.remotecontrol(session.id)]),
    isAlive: true,
    queue: Promise.resolve(),
    typingTimers: new Map(),
    controlSessionId: session.id,
  };
  clients.set(ws, client);
  bySessionId.set(sessionid, client);
  controlSessions.set(session.id, {
    controller: session.controlleruserid,
    host: session.hostuserid,
    agent: client,
    status: "granted",
  });

  ws.on("pong", () => {
    client.isAlive = true;
  });
  ws.on("message", (data) => {
    client.queue = client.queue
      .then(() => handleMessage(client, String(data)))
      .catch((err) => console.error("[ws] agent message error:", (err as Error).message));
  });
  ws.on("close", () => void removeClient(client));
  ws.on("error", () => void removeClient(client));
  send(ws, { type: "connected", sessionid, userid: client.userid, servertime: Date.now() });
}

wss.on("connection", async (ws, req) => {
  // Primary auth: a signed short-lived token in the handshake URL (?token=…) —
  // works cross-domain (browser on the app's domain → engine on ws.wxperts.com).
  // Fallback: the yc_session cookie (same-site/local dev).
  const url = new URL(req.url ?? "/", `http://localhost:${WS_PORT}`);
  // Spec 088 — a control agent authenticates with its single-use control token.
  const controlToken = url.searchParams.get("controltoken");
  if (controlToken) {
    await handleAgentConnection(ws, controlToken);
    return;
  }
  let userid = verifyWsToken(url.searchParams.get("token"));
  if (!userid) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE];
    userid = sessionToken ? await validateSession(sessionToken) : null;
  }
  if (!userid) {
    send(ws, { type: "error", error: "unauthorized" });
    ws.close(4401, "unauthorized");
    return;
  }

  const sessionid = uuidv7();
  const client: Client = {
    ws,
    sessionid,
    userid,
    subs: new Set([scopes.user(userid), scopes.broadcast]),
    isAlive: true,
    queue: Promise.resolve(),
    typingTimers: new Map(),
  };
  clients.set(ws, client);
  bySessionId.set(sessionid, client);

  // Seed the per-connection queue with connect-time work (register the session
  // row + publish presence). Listeners are attached SYNCHRONOUSLY below and chain
  // onto this queue, so an early client message (e.g. a subscribe sent right after
  // `connected`) is never dropped and always runs AFTER setup, in order.
  client.queue = (async () => {
    const db = getDb();
    if (db)
      await db
        .insert(wssessions)
        .values({ userid, id: sessionid, subscriptions: [...client.subs] })
        .catch((err) => console.error("[ws] wssessions insert failed:", (err as Error).message));
    await onClientOnline(client);
  })();

  ws.on("pong", () => {
    client.isAlive = true;
  });

  // Serialize message handling so an async subscribe can't be overtaken by a
  // following resume (resume reads the client's subscription set).
  ws.on("message", (data) => {
    client.queue = client.queue.then(() => handleMessage(client, String(data))).catch((err) => {
      console.error("[ws] message handler error:", (err as Error).message);
    });
  });

  ws.on("close", () => void removeClient(client));
  ws.on("error", () => void removeClient(client));

  // First message: authenticated + registered. (avoids a race where events
  // published immediately after the handshake miss this client.)
  send(ws, { type: "connected", sessionid, userid, servertime: Date.now() });
});

// WS-level heartbeat: terminate connections that stop responding to pings.
const heartbeat = setInterval(() => {
  for (const client of clients.values()) {
    if (!client.isAlive) {
      client.ws.terminate();
      void removeClient(client);
      continue;
    }
    client.isAlive = false;
    client.ws.ping();
  }
}, 30_000);

// T005 cleanup: drop expired replay-log rows so they don't accumulate.
const cleanup = setInterval(() => {
  const db = getDb();
  if (db) void db.delete(wsevents).where(lt(wsevents.expiresat, new Date())).catch(() => {});
}, 60_000);

// T007 capacity monitor.
const capacityTimer = setInterval(checkCapacity, 60_000);

wss.on("close", () => {
  clearInterval(heartbeat);
  clearInterval(cleanup);
  clearInterval(capacityTimer);
});

httpServer.listen(WS_PORT, () => {
  console.info(`[ws] engine listening on :${WS_PORT} (max ${MAX_CONNECTIONS} conns)`);
});

// On startup, clear any stale session rows from a previous unclean shutdown.
(() => {
  const db = getDb();
  if (db) void db.delete(wssessions).catch(() => {});
})();
