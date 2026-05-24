# Spec 003: WebSocket Engine

**Spec Number**: 003
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: None — all other scopes depend on this one
**Source**: `specs/Project-Scope/003-websocket-engine-providing-real-time.md`

---

## Overview

The WebSocket Engine is the real-time transport layer that underpins all of YappChat. Every live update — an inbound message appearing in a conversation, a PA notification bubble, an agent status changing, a directory member going online, a video room firing a participant-joined event, an org directory tree updating — is delivered through this engine.

It is a persistent, bidirectional server running on `ws://` / `wss://` that clients connect to on startup and maintain for the duration of their session. The engine is purely infrastructure: it has no business logic of its own. It receives typed **events** from YappChat server processes and routes them to the connected clients that have subscribed to the relevant **scope**.

All other specs reference this engine for their real-time delivery guarantees. Spec 003 owns the engine itself — the server, the subscription model, the authentication, the heartbeat, the reconnection with state recovery, and the event log.

The `ws` npm package (Apache 2.0) is already present in the YappChat workspace (used by Discord and Mattermost extensions). The OpenClaw gateway layer in `packages/openclaw/src/gateway/` already has WebSocket server infrastructure (`gateway/client.ts`, `gateway/server-broadcast.ts`) that this spec builds on.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat client (browser or mobile WebView) |
| **Secondary Actors** | YappChat server processes (message engine, PA, agent manager, directory service, video service) |
| **Key Value** | Every live update in YappChat — messages, presence, PA notifications, agent status, directory changes, video events — is delivered through a single persistent connection per client. No polling, no page refresh required. |
| **Scope Boundary** | IN SCOPE: WebSocket server; typed event envelope; subscription model (scope-based); authentication; heartbeat/ping-pong; client reconnection with state recovery; event log for replay; presence (online/offline/in-call); typing indicators; all event types referenced by specs 001, 002, 004, 005, 006, 007. OUT OF SCOPE: application-level business logic (owned by each spec); message content (owned by spec 001); video media transport (owned by OpenVidu/LiveKit in spec 001); push notifications to mobile when the app is backgrounded (separate scope). |

---

## Event System

### Envelope format

Every event sent over the WebSocket uses this typed envelope:

```typescript
interface WSEvent {
  id: string       // UUID v7 — used for deduplication and replay
  type: string     // dot-notation type: "message.inbound" | "presence.online" | etc.
  scope: string    // routing key — see subscription model below
  payload: unknown // event-specific data (typed per event type)
  ts: number       // Unix timestamp milliseconds
}
```

### Scope / subscription model

Clients subscribe to one or more scopes. The engine routes each event only to clients subscribed to the matching scope.

| Scope pattern | Who subscribes | Example events |
| --- | --- | --- |
| `user:{userid}` | The user's own sessions | PA notifications, delivery receipts, personal presence, subagent status, MCP server status |
| `channel:{channelid}` | Anyone viewing that channel | Inbound messages, typing indicators, delivery status |
| `org:{orgid}` | Users in that org | Directory member added/updated/removed, group changes |
| `agent:{agentid}` | Users watching an agent | Agent status change, agent message |
| `videoroom:{roomid}` | Participants and observers | Participant joined/left, room ended |
| `pairing:{pairingid}` | Single-use device-pairing sessions (spec 010 FR-005) | Encrypted key bundle delivery from existing device to new device |
| `broadcast` | All connected clients | System maintenance, global announcements |

**Authorization rule for `pairing:{pairingid}`**: subscribe is permitted only when the caller is the user that initiated the pairing AND the pairing nonce in the subscribe message matches `keypairings.nonce` for that row AND the pairing has not yet expired. Spec 010 owns the pairing record; spec 003 enforces the auth check by querying `keypairings` at subscribe time. Pairings are single-use — once one ciphertext is delivered through the scope, subsequent subscribes are rejected.

A single client typically subscribes to: `user:{self}` + `channel:{*}` for all open conversations + `org:{orgid}` for their org.

### Event type catalogue

| Event type | Scope | Fired when | Payload summary |
| --- | --- | --- | --- |
| `message.inbound` | `channel:{id}` | Inbound message arrives and is acked | `{ messageid, channelid, authorid, content, encryptiontype, direction, createdat }` |
| `message.delivery_status` | `user:{id}` | A sent message changes ackstate | `{ messageid, channelid, ackstate, ackedat }` |
| `message.typing_start` | `channel:{id}` | User starts typing in a channel | `{ channelid, userid, orgmemberid? }` |
| `message.typing_stop` | `channel:{id}` | User stops typing or 5s timeout | `{ channelid, userid }` |
| `presence.online` | `org:{id}` | User connects a WebSocket session | `{ userid, orgmemberid?, status: "online" }` |
| `presence.offline` | `org:{id}` | All user sessions disconnect | `{ userid, orgmemberid?, status: "offline" }` |
| `presence.in_call` | `org:{id}` | User joins a video room | `{ userid, orgmemberid?, status: "in_call", videoroomid }` |
| `channel.health` | `user:{id}` | Channel adapter status changes | `{ channelid, status: "healthy"\|"degraded"\|"offline" }` |
| `agent.status` | `agent:{id}` | Agent updates its status | `{ agentid, status, description, updatedat }` |
| `agent.message` | `agent:{id}` | Agent posts a message | `{ agentid, messageid, content, createdat }` |
| `pa.notification` | `user:{id}` | PA posts a notification | `{ notificationid, type, previewtext, payload }` |
| `pa.status` | `user:{id}` | PA status badge changes | `{ status, providerid, providerlabel }` |
| `directory.member_updated` | `org:{id}` | Org member name/avatar/location changes | `{ orgmemberid, orgid, fields: [...] }` |
| `directory.member_added` | `org:{id}` | New member added to org or group | `{ orgmemberid, orgid, groupid? }` |
| `directory.member_removed` | `org:{id}` | Member removed | `{ orgmemberid, orgid, groupid? }` |
| `directory.status` | `org:{id}` | Member online/offline/in_call changes | `{ orgmemberid, status }` |
| `videoroom.participant_joined` | `videoroom:{id}` | Participant connects to room | `{ videoroomid, orgmemberid, role }` |
| `videoroom.participant_left` | `videoroom:{id}` | Participant disconnects | `{ videoroomid, orgmemberid, leftat }` |
| `videoroom.ended` | `videoroom:{id}` | Host ends room | `{ videoroomid, endedat }` |
| `skill.update_available` | `user:{id}` | Installed community skill has a new version | `{ communityskillid, fromversion, toversion, changesummary }` |
| `mcp.server_status` | `user:{id}` | MCP server connection state changes | `{ mcpserverid, status, lasterrormessage? }` |
| `subagent.status` | `user:{id}` | Spec 002 FR-015 subagent state change | `{ subagentexecutionid, agenttemplateid, status, parentsessionid?, errormessage? }` |
| `avatar.conversion_complete` | `user:{id}` | Spec 007 FR-007 photo-to-avatar job finished | `{ jobid, avatarkey, fileurl }` |
| `keybackup.recovery_alert` | `user:{id}` | Spec 010 FR-004 — failed recovery attempts threshold crossed | `{ failedcount, windowstartedat, lockeduntil? }` |
| `keypairing.delivered` | `pairing:{pairingid}` | Spec 010 FR-005 — encrypted key bundle delivered to new device | `{ eph_pub_old, ciphertext, nonce }` |

---

## User Scenarios & Testing

### US1 — Message appears in real time without refresh

**Actor**: YappChat user (browser)

**Scenario**:

1. User A has conversation view open on Slack #engineering channel.
2. An external Slack user sends a message. The spec 001 inbound pipeline processes it, acks it, and publishes a `message.inbound` event scoped to `channel:{channelid}`.
3. The WebSocket engine routes the event to all connected clients subscribed to that channel scope — including User A's session.
4. User A's `UnifiedMessageFeed` receives the event and appends the new message without any poll or page reload.

**Expected outcome**: Message appears in User A's feed within 100ms of the engine publishing the event.

### US2 — Presence updates across the org directory

**Actor**: YappChat user (browser)

**Scenario**:

1. User B opens YappChat. Their WebSocket session connects and sends a `subscribe` message for `user:{B}` and `org:{orgid}`.
2. The engine publishes `presence.online` scoped to `org:{orgid}`.
3. All other users who have the `OrgDirectoryTree` open and are subscribed to `org:{orgid}` see User B's status dot turn green immediately.
4. User B joins a video call. The engine publishes `presence.in_call` with the `videoroomid`.
5. User B's `OrgNode` in all other clients shows the "in call" indicator within 100ms.

**Expected outcome**: Presence state changes are reflected in the org directory across all connected clients within 100ms.

### US3 — Client disconnects and recovers missed events on reconnect

**Actor**: YappChat client (browser)

**Scenario**:

1. User's browser loses network connectivity for 45 seconds.
2. The WebSocket client detects the disconnect (heartbeat timeout) and begins exponential backoff reconnection.
3. Network recovers. Client reconnects, authenticates, and sends a `resume` message: `{ lastEventId: "<last-received-event-uuid>" }`.
4. The engine queries `wsevents` for all events scoped to the client's subscriptions with `id > lastEventId` and `expiresat > now()`.
5. Missed events are replayed to the client in order. New `message.inbound` events appear in the feed; presence updates correct the directory state.

**Expected outcome**: Client recovers full state within 3 seconds of reconnect. No manual refresh required. Events that occurred during the disconnect are not lost (within the 5-minute event log window).

### US4 — Typing indicator in a conversation

**Actor**: YappChat user (browser)

**Scenario**:

1. User C starts typing in a channel conversation. The browser sends a `typing` client message to the WebSocket server.
2. The engine publishes `message.typing_start` scoped to `channel:{channelid}`.
3. Other users viewing that conversation see the typing indicator ("User C is typing…") appear.
4. User C stops typing. After 5 seconds of no keystroke, the browser sends a `typing_stop` message (or the server times out the typing state). `message.typing_stop` is published and the indicator disappears.

**Expected outcome**: Typing indicator appears within 100ms of the user starting to type and clears within 5 seconds of them stopping.

---

## Functional Requirements

### FR-001 — WebSocket server and connection lifecycle

The engine MUST run a persistent WebSocket server. Clients connect once on startup, authenticate, and maintain the connection for the session lifetime.

**Acceptance Criteria**:

- [ ] WebSocket server runs on `wss://{host}/ws` (TLS required in production; `ws://` permitted in development only)
- [ ] Client connects by passing a short-lived auth token: `wss://host/ws?token=<token>` or via `Authorization: Bearer <token>` upgrade header
- [ ] Auth token is validated on connect — invalid or expired tokens are rejected with close code `4001` before any data is exchanged
- [ ] On successful connect, the server sends a `connected` event: `{ sessionid, userid, servertime }` as the first message
- [ ] The server maintains a `wssessions` record for each connected client: `userid`, `sessionid`, `subscriptions[]`, `connectedat`
- [ ] A user may have multiple concurrent sessions (multiple browser tabs, mobile + desktop) — all receive events that match their subscriptions
- [ ] Server supports at least 1,000 concurrent WebSocket connections on a single Node.js process
- [ ] Server is built with the `ws` npm package already present in the workspace

### FR-002 — Subscription management

Clients explicitly subscribe to and unsubscribe from scopes. The engine routes events only to clients with a matching active subscription.

**Acceptance Criteria**:

- [ ] Client sends `{ type: "subscribe", scopes: ["user:{id}", "channel:{id}", "org:{id}"] }` to subscribe to multiple scopes in one message
- [ ] Client sends `{ type: "unsubscribe", scopes: ["channel:{id}"] }` to remove subscriptions (e.g., when closing a conversation tab)
- [ ] Subscriptions are stored in memory per session — not persisted. On reconnect, the client re-subscribes as part of the resume handshake
- [ ] The engine enforces subscription authorization: a client may only subscribe to scopes belonging to their authenticated user (e.g., cannot subscribe to another user's `user:{otherid}` scope or an org they don't belong to)
- [ ] Unauthorized subscription attempts are rejected with `{ type: "error", code: "unauthorized_scope", scope }` — the connection is not closed

### FR-003 — Event publishing (server → clients)

Server processes publish events to the engine; the engine routes them to subscribed clients.

**Acceptance Criteria**:

- [ ] Server processes publish events via an internal publish API: `wsEngine.publish(event: WSEvent)` — not via a network call; the engine runs in-process or via Redis pub/sub (see FR-007)
- [ ] Published events are routed to all sessions with a subscription matching the event's `scope`
- [ ] Events are delivered to matched clients within 100ms of being published under normal load (single-server deployment)
- [ ] Events that cannot be delivered to a disconnected client are written to `wsevents` for replay on reconnect (see FR-005)
- [ ] Event IDs are UUID v7 — monotonically ordered, suitable for replay cursor

### FR-004 — Heartbeat and dead connection detection

The engine MUST detect stale connections and clean them up without blocking the event loop.

**Acceptance Criteria**:

- [ ] Server sends a WebSocket `ping` frame to each client every 30 seconds
- [ ] If a client does not respond with a `pong` within 10 seconds, the connection is considered dead — closed with code `1001` (Going Away) and the `wssessions` row is deleted
- [ ] Client-side: the client sends its own `{ type: "heartbeat" }` message every 25 seconds; the server responds with `{ type: "heartbeat_ack" }`. This serves as the application-level keepalive complementary to the WebSocket ping/pong
- [ ] If the client does not receive a `heartbeat_ack` within 10 seconds of sending, it treats the connection as dead and begins reconnection

### FR-005 — Event log for replay on reconnect

Events MUST be written to a short-lived log so clients can recover missed events on reconnect without requiring a full page refresh.

**Acceptance Criteria**:

- [ ] Every published event is inserted into `wsevents` with a 5-minute TTL (`expiresat = ts + 300000ms`)
- [ ] Events older than `expiresat` are deleted by a background cleanup job (runs every 60 seconds)
- [ ] On reconnect, client sends `{ type: "resume", lastEventId: "<uuid>" }`. The engine queries `wsevents WHERE id > lastEventId AND expiresat > now() AND scope IN (client_subscriptions)` and replays results in `id` order
- [ ] If `lastEventId` is not found (client was disconnected longer than 5 minutes), the engine sends `{ type: "replay_unavailable", reason: "event_log_expired" }` and the client falls back to a full REST refresh of affected resources
- [ ] The replay response is `{ type: "replay_start", count }` followed by the events, then `{ type: "replay_end" }`
- [ ] Events in the log are scoped the same way as live events — a client only receives replay events matching its subscriptions

### FR-006 — Presence and typing

The engine MUST maintain per-user presence state and broadcast it to subscribed org clients. Typing indicators are transient and require no persistence.

**Acceptance Criteria**:

- [ ] On connect, the engine publishes `presence.online` scoped to all orgs the user belongs to
- [ ] On disconnect (or dead connection cleanup), if the user has no remaining active sessions, the engine publishes `presence.offline`
- [ ] Presence state (`online` | `offline` | `in_call`) is stored in memory (Redis in multi-server, in-process Map in single-server v1) — not in PostgreSQL
- [ ] `GET /api/ws/presence?orgid={id}` returns current presence state for all members of that org — used by clients on initial page load before WebSocket subscriptions are established
- [ ] Typing: client sends `{ type: "typing", channelid }` → engine publishes `message.typing_start` scoped to `channel:{channelid}`. Server-side timer auto-publishes `message.typing_stop` after 5 seconds of no repeat typing message from that user. Client can send `{ type: "typing_stop", channelid }` to cancel early.
- [ ] Typing state is in-memory only — no database writes

### FR-007 — Horizontal scaling path (single-server v1, Redis-ready) and capacity alerting

V1 runs on a single Node.js process. The architecture MUST be designed from the start to support Redis pub/sub for horizontal scaling without rewriting the event routing logic. The engine MUST also monitor its own connection count and notify the administrator before capacity is exhausted.

**Acceptance Criteria**:

- [ ] The internal publish interface (`wsEngine.publish(event)`) is abstracted behind a `WSBroker` interface with two implementations: `LocalBroker` (in-process, Map-based — used in v1) and `RedisBroker` (pub/sub via `ioredis` — used when `WS_BROKER=redis` env var is set)
- [ ] Switching from `LocalBroker` to `RedisBroker` requires only setting `WS_BROKER=redis` and `REDIS_URL` — no application code changes
- [ ] `LocalBroker` is the default for v1. `RedisBroker` is implemented but not deployed until horizontal scaling is required
- [ ] The `wsevents` log is in PostgreSQL — shared across all server instances in both broker modes
- [ ] **Capacity monitoring**: the engine tracks the current active connection count from `wssessions` every 60 seconds. The capacity ceiling is set via the `WS_MAX_CONNECTIONS` env var (default: `1000`)
- [ ] **70% threshold alert**: when active connections reach or exceed 70% of `WS_MAX_CONNECTIONS` (default trigger: 700 connections), the engine sends a YappChat PA channel notification to the admin user `andy@wxperts.com` with the message:

  > ⚠️ **WebSocket capacity warning — action recommended**
  >
  > Active connections: **{current}** of {max} ({pct}% of capacity).
  >
  > The WebSocket engine is approaching its single-process limit. Switch to the Redis broker to support horizontal scaling before connections are refused.
  >
  > **To upgrade:** set `WS_BROKER=redis` and `REDIS_URL` in the server environment and restart. No code changes required.
  >
  > Next check in 24 hours unless connections drop below 70%.

- [ ] The alert is sent **at most once per 24 hours** — if capacity stays above 70% the engine does not spam a notification on every check. The alert re-arms (will fire again) only after connections drop below 60% and then rise above 70% again
- [ ] A second, more urgent alert fires at **90% capacity** (900 connections with default ceiling) using the same delivery mechanism:

  > 🚨 **WebSocket capacity critical — immediate action required**
  >
  > Active connections: **{current}** of {max} ({pct}% of capacity). New connections may be refused soon.

- [ ] Alert delivery uses the spec 002 FR-017 internal `postPANotification` SDK with `bypassQuietHours: true`, `callerscope: "ws-capacity"`. Recipients: **every user where `users.issystemadmin = true`** (spec 011 FR-009). The engine fans the alert to each system admin once per occurrence — admins independently honour the 24-hour dedup window. If zero system admins exist yet (pre-bootstrap), the alert falls back to a server-side `console.error` log entry with the same content
- [ ] `GET /api/ws/stats` returns: `{ activeConnections, maxConnections, pct, broker: "local"|"redis", alertThreshold70Triggered, alertThreshold90Triggered, lastAlertSentAt }`

---

## Data Requirements

Minimal — the WebSocket engine is stateless by design. Only two tables are needed.

| Table | Purpose |
| --- | --- |
| `wssessions` | Active connection registry — one row per connected client session |
| `wsevents` | Short-lived event log for replay on reconnect — 5-minute TTL |

### `wssessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK — the session ID sent to client on connect |
| `userid` | text | Authenticated user |
| `subscriptions` | text[] | Current scope subscriptions for this session |
| `connectedat` | timestamptz | |
| `lastheartbeat` | timestamptz | Updated on each heartbeat ack |

Rows are deleted when the connection closes or is cleaned up by dead-connection detection.

### `wsevents`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK — monotonic, used as replay cursor |
| `type` | text | Event type (e.g., `message.inbound`) |
| `scope` | text | Routing scope (e.g., `channel:abc123`) |
| `payload` | jsonb | Event-specific data |
| `ts` | bigint | Unix timestamp milliseconds |
| `expiresat` | timestamptz | Now + 5 minutes — indexed for cleanup job |

Index: `(scope, id)` — used for replay queries filtered by scope and cursor.
Index: `(expiresat)` — used by cleanup job.

---

## API Routes

The WebSocket engine exposes only the WebSocket endpoint itself plus a small REST companion for initial state.

| Method | Path | Description |
| --- | --- | --- |
| WS | `/ws` | Primary WebSocket endpoint — requires `?token=` or `Authorization` header |
| GET | `/api/ws/presence` | Current presence state for all members of an org — params: `orgid`. Used on page load before WS subscriptions resolve. |
| GET | `/api/ws/sessions` | Admin only — list active sessions with userid, subscriptions, connected time |
| DELETE | `/api/ws/sessions/:id` | Admin only — force-close a specific session (e.g., account deactivated) |
| GET | `/api/ws/stats` | Admin only — `{ activeConnections, maxConnections, pct, broker, alertThreshold70Triggered, alertThreshold90Triggered, lastAlertSentAt }` |

### WebSocket message protocol (client → server)

| Message type | Payload | Description |
| --- | --- | --- |
| `subscribe` | `{ scopes: string[] }` | Subscribe to one or more scopes |
| `unsubscribe` | `{ scopes: string[] }` | Remove scope subscriptions |
| `resume` | `{ lastEventId: string }` | Request missed event replay on reconnect |
| `heartbeat` | `{}` | Application-level keepalive |
| `typing` | `{ channelid: string }` | User is typing in a channel |
| `typing_stop` | `{ channelid: string }` | User stopped typing |

### WebSocket message protocol (server → client)

| Message type | Description |
| --- | --- |
| `connected` | Sent immediately on successful connect — includes `sessionid`, `userid`, `servertime` |
| `event` | Wrapped `WSEvent` — the primary delivery message |
| `heartbeat_ack` | Response to client `heartbeat` |
| `replay_start` | Begins a replay sequence — includes event count |
| `replay_end` | Ends a replay sequence |
| `replay_unavailable` | Event log expired; client must do a full REST refresh |
| `error` | Non-fatal error (e.g., unauthorized scope) — connection stays open |

---

## Frontend Components

The WebSocket engine has no UI of its own. It provides a **client-side library** used by all other scopes.

### `WSClient` — client library (`src/lib/ws-client.ts`)

Not a React component — a singleton class used by all scopes.

| Method / Property | Description |
| --- | --- |
| `WSClient.connect(token)` | Establish connection; starts heartbeat loop |
| `WSClient.subscribe(scopes[])` | Subscribe to scopes |
| `WSClient.unsubscribe(scopes[])` | Remove subscriptions |
| `WSClient.on(eventType, handler)` | Register event listener for a specific event type |
| `WSClient.off(eventType, handler)` | Remove listener |
| `WSClient.sendTyping(channelid)` | Throttled typing indicator send (debounced to 2s) |
| `WSClient.disconnect()` | Graceful close |
| `WSClient.status` | `"connecting"` \| `"connected"` \| `"reconnecting"` \| `"disconnected"` |
| Reconnection | Automatic exponential backoff: 1s → 2s → 4s → 8s → max 30s. Sends `resume` on reconnect. |

### React integration components

| Component | Path | Description |
| --- | --- | --- |
| `WSProvider` | `src/ui/providers/WSProvider.tsx` | React context provider — wraps the app, manages `WSClient` singleton lifecycle (connect on mount, disconnect on unmount), exposes `useWSClient()` hook |
| `useWSEvent` | `src/ui/hooks/useWSEvent.ts` | Hook: `useWSEvent(eventType, handler, deps[])` — subscribes to a specific event type from the nearest `WSProvider`. Cleans up listener on unmount. |
| `usePresence` | `src/ui/hooks/usePresence.ts` | Hook: returns current presence state for a `userid` or `orgid`. Listens to `presence.*` events and keeps a local Map updated. |
| `useTypingIndicator` | `src/ui/hooks/useTypingIndicator.ts` | Hook: returns the set of userids currently typing in a given `channelid`. Manages typing-start/stop timers locally. |
| `WSStatusIndicator` | `src/ui/components/ws/WSStatusIndicator.tsx` | Small icon in the app header showing WebSocket connection status — green dot (connected), amber spinner (reconnecting), red dot (disconnected). Click shows last disconnect reason. |

---

## Success Criteria

1. Inbound messages appear in the `UnifiedMessageFeed` within 100ms of the engine publishing the `message.inbound` event under normal load.
2. Presence changes (online/offline/in-call) appear in the `OrgDirectoryTree` within 100ms for all subscribed clients.
3. A client that disconnects for up to 5 minutes reconnects and recovers all missed events without a page refresh within 3 seconds.
4. A client that was disconnected for more than 5 minutes receives `replay_unavailable` and falls back gracefully to a REST refresh.
5. The server handles 1,000 concurrent WebSocket connections on a single Node.js process without event delivery latency exceeding 200ms.
6. Switching from `LocalBroker` to `RedisBroker` requires only environment variable changes — no code changes.
7. When active connections reach 700 (70% of the 1,000 default ceiling), a warning notification is delivered to `andy@wxperts.com` via the YappChat PA channel within 60 seconds of the threshold being crossed. A second critical alert fires at 900 connections (90%). Neither alert fires more than once per 24 hours unless connections drop and rise again.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `WSEvent` | TypeScript interface in `src/lib/ws-client.ts` | The canonical event envelope — `id`, `type`, `scope`, `payload`, `ts`. Every real-time update in YappChat is a `WSEvent`. |
| `WSSession` | `wssessions` table | One active client connection — userid, scope subscriptions, heartbeat timestamp. Deleted on disconnect. |
| `WSEventLog` | `wsevents` table | Short-lived event log for replay — 5-minute TTL. Enables missed-event recovery without full REST refresh. |
| `WSBroker` | TypeScript interface | Abstraction over event routing — `LocalBroker` (in-process) for v1, `RedisBroker` (pub/sub) for horizontal scale. |
| `WSClient` | `src/lib/ws-client.ts` | Client-side singleton managing the WebSocket connection, reconnection, subscription, and event dispatch. |

---

## Constraints

- All WebSocket traffic in production MUST use TLS (`wss://`). Plaintext `ws://` is only permitted on localhost.
- Auth token validation MUST happen before any subscription or data exchange. Invalid token → close code `4001`, connection terminated immediately.
- A client MUST NOT be able to subscribe to scopes belonging to another user or an org they are not a member of. Server enforces this — client trust is never assumed.
- Typing indicators are in-memory only — never written to PostgreSQL. They are ephemeral and acceptable to lose on server restart.
- Presence state is in-memory only (Map or Redis) — not in PostgreSQL. On server restart, presence is rebuilt from reconnecting sessions.
- The event log TTL is fixed at 5 minutes. This is intentionally short — the log is for transient recovery, not a message store. Spec 001 owns durable message persistence.
- The WebSocket engine MUST NOT contain any business logic. Its only job is routing events from publishers to subscribers. Business logic stays in the originating spec's service layer.
- `wsevents` rows that have passed `expiresat` MUST be deleted by the cleanup job — they must not accumulate indefinitely.

---

## Notes

### Code already in the workspace

| What | Location |
| --- | --- |
| `ws` npm package | `packages/openclaw/node_modules/ws` (via workspace) — also direct dep of Discord and Mattermost extensions |
| OpenClaw gateway WebSocket infrastructure | `packages/openclaw/src/gateway/client.ts`, `packages/openclaw/src/gateway/server-broadcast.ts` |
| Gateway chat (TUI) | `packages/openclaw/src/tui/gateway-chat.ts` — reference implementation of client-side WS handling |

### Integration points

All other specs publish events to the engine via `wsEngine.publish(event)`. The publish call is a fire-and-forget from the publisher's perspective — the engine handles routing, logging, and delivery.

| Publishing spec | Events it publishes |
| --- | --- |
| Spec 001 (Chat Engine) | `message.inbound`, `message.delivery_status`, `message.typing_*`, `channel.health`, `directory.*`, `videoroom.*`, `agent.*` |
| Spec 002 (PA) | `pa.notification`, `pa.status`, `skill.update_available`, `mcp.server_status` |
| Spec 004 (Agent/Skill) | `skill.registered`, `skill.updated` |

### Risks

- **Single-process bottleneck**: v1 runs one Node.js process. At ~1,000 concurrent connections, the event loop may become a bottleneck. The Redis broker path must be validated with load testing before production deployment.
- **Event log size**: `wsevents` writes every routed event. At high message volume this can grow quickly. The 5-minute TTL + 60-second cleanup job must be validated under load.
- **Token expiry mid-session**: if a client's auth token expires while connected, the WebSocket connection should remain open (token is only validated on connect). Rotating credentials should not drop active sessions.
- **Mobile background**: when a mobile app goes to the background, the OS may terminate the WebSocket connection. Handling for this is deferred to a push notification scope — this spec only covers foreground/tab-visible reconnection.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | What library for the server? | `ws` npm package — already in the workspace |
| 2 | Single server or clustered for v1? | Single Node.js process for v1; Redis broker path designed in from the start |
| 3 | How do clients recover missed events? | `resume` message with `lastEventId` → replay from `wsevents` log (5-minute window) |
| 4 | Where is presence stored? | In-memory only (Map in v1, Redis in clustered) — not PostgreSQL |
| 5 | Does this scope include push notifications for mobile background? | No — deferred to a separate scope |
| 6 | What is the event log TTL? | 5 minutes — sufficient for transient network issues, not intended as a message store |
