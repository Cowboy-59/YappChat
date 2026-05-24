# Spec 001: Common Chat Engine

**Spec Number**: 001
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: None
**Source**: `specs/Project-Scope/001-common-chat-engine-that-receives.md`

## Overview

The Common Chat Engine is the unified communication bus at the heart of YappChat. It covers three interconnected capabilities:

**1. Messaging** — 23 external platform integrations (Slack, Discord, Telegram, WhatsApp, Matrix, Mattermost, IRC, Signal, MS Teams, Feishu, Google Chat, LINE, Twitch, iMessage, Nextcloud Talk, QQ Bot, Nostr, Zalo, Voice Call, Webhooks) plus a native internal `yappchat-agent` platform for AI coding agents — all normalized through a `ChannelPlugin` system already present in `extensions/`.

**4. AI agent channels** — Any AI coding agent (Claude Code, Cursor, a custom LLM process) can register a YappChat channel and avatar. During development the agent sends questions and status updates into its channel; developers reply in the `AgentChannelPanel`; the engine delivers the reply to the agent's `callbackurl` so it can continue work.

**2. Video chat** — Zoom-style real-time video conferencing embedded in YappChat via **OpenVidu 3.x** (`livekit-client` SDK, Apache 2.0). Rooms are created ad hoc from any conversation. Participants join via browser WebRTC with no plugin required. Self-hosted on Docker Compose alongside YappChat services.

**3. Organizational directory** — A parent-child hierarchy of Company → Groups → Individuals. Every entity carries an avatar, display name, and location. The directory drives channel routing (send to a group), video room invites (call a team), and identity display throughout the UI.

Each platform is a `ChannelPlugin` loaded via `defineBundledChannelEntry()` → `BundledChannelEntryContract`. The engine manages plugin lifecycle via `ChannelGatewayAdapter.startAccount/stopAccount`, sends via `ChannelMessageSendTextContext` → `sendDurableMessageBatch()` → `MessageReceipt`, and receives via `MessageReceiveContext<TMessage>` with an ack/nack lifecycle (`pending` → `acked` | `nacked`).

Every other YappChat module (personal assistant, AI chat, AI avatar, document generation) calls only the engine. No module imports from `extensions/` directly. Adding or replacing a platform requires zero changes outside that extension folder.

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat user (web or mobile) |
| **Secondary Actors** | AI agent / personal assistant, External platform users (Slack, Discord, etc.), YappChat administrator |
| **Key Value** | Each feature in YappChat would otherwise need to know about every messaging platform. The chat engine provides one normalized Message type and one send/receive API so every other module — personal assistant, AI chat, AI avatar — talks only to the engine, not to Slack, Discord, etc. directly. |
| **Scope Boundary** | IN SCOPE: normalized Message schema; ChannelPlugin lifecycle; inbound/outbound pipelines with ack/nack; channel health monitoring; message persistence; multi-channel send API; WebSocket real-time delivery; OpenVidu 3.x video rooms; org directory (Company → Groups → Individuals) with avatar/name/location; AI agent channels; E2E encryption for all YappChat-to-YappChat messages; user-controlled message retention (default: forever) with undelivered-message exemption. OUT OF SCOPE: AI response generation (scope 005); skill execution (scope 002); document generation (scope 006); AI Avatar rendering (scope 007); WebSocket engine internals (scope 003); user auth/login; billing; analytics dashboards. |

## User Scenarios & Testing

### US1 — Open a conversation and send messages within it

**Actor**: YappChat user (web or mobile)

**Scenario**:

1. User opens the conversation sidebar and selects a target — one of three kinds:
   - **Channel** (e.g., "Company Slack #general", "Discord #announcements") — an external platform channel registered in the engine
   - **Group** (e.g., "Engineering Team") — an org directory group; the engine fans the message out to all group members
   - **Person** (e.g., "Andy Stapleton") — a direct message to one org member, resolved to their linked platform or internal YappChat channel
2. The engine opens (or resumes) a `conversations` record for that target and sets it as the **active conversation context**. The message composer is now bound to this target — all messages typed go to this target until the user navigates to a different one. No target re-selection is needed per message.
3. User types a message and sends. The engine builds a `ChannelMessageSendTextContext` scoped to the active conversation's resolved target(s) and calls `sendDurableMessageBatch()`.
4. Each adapter returns a `MessageReceipt` containing `primaryPlatformMessageId`, `platformMessageIds[]`, and `sentAt`. The engine persists one `messagedeliveries` row per channel with `ackstate: acked`.
5. All replies arriving from the target (inbound `MessageReceiveContext` events matching the active `conversationid`) appear automatically in the conversation view in real time. The user sees a continuous threaded conversation — their sent messages and the target's replies interleaved in chronological order.
6. User navigates to a different target in the sidebar — the active conversation context switches to the new target. The previous conversation is bookmarked at the last-read message for return.

**Expected outcome**: Within 2 seconds of selecting a target, the conversation view is open and the composer is ready. Sent messages appear on the target platform within 2 seconds. Inbound replies appear in the conversation view in real time. Switching targets is instant — each conversation retains its scroll position and last-read marker.

### US2 — Receive a message from an external platform

**Actor**: External platform user (e.g., a Slack team member)

**Scenario**:

1. An external user sends a message in a Slack channel connected to YappChat.
2. The Slack plugin's `ChannelGatewayAdapter.startAccount()` is already running, listening for events.
3. The event arrives as a `MessageReceiveContext<TMessage>` with `ackState: "pending"`.
4. The engine persists the message to the `messages` table and calls `ctx.ack()` — advancing `ackstate` to `"acked"`.
5. The persisted message is broadcast over WebSocket to all connected YappChat clients.

**Expected outcome**: The inbound message appears in the YappChat feed within 2 seconds, with the sender identity, `authorid`, platform badge, and content preserved. `ackstate` is `acked` in the database.

### US3 — Channel plugin disconnects and reconnects with no message loss

**Actor**: YappChat system (automated)

**Scenario**:

1. A channel plugin (e.g., Telegram) calls `stopAccount()` due to a network drop; the engine records `ChannelAccountSnapshot` status as `degraded`.
2. Any outbound `messagedeliveries` rows in `ackstate: pending` remain durable in the database.
3. The engine calls `startAccount()` with exponential backoff until the adapter reconnects.
4. On reconnect, pending `messagedeliveries` rows are replayed via `sendDurableMessageBatch()`. Inbound gaps are reconciled using `platformmessageid` deduplication.

**Expected outcome**: No outbound messages are lost. The `ChannelHealthSummary` for that account returns to a healthy state. An audit log entry captures the disconnect/reconnect timestamps.

### US4 — Start a video call from a conversation

**Actor**: YappChat user (web or mobile)

**Scenario**:

1. User is in a YappChat conversation (individual or group) and clicks "Start video call."
2. The engine creates a new `videorooms` record and requests an OpenVidu session token from the self-hosted OpenVidu 3.x server via the `livekit-client` token API.
3. The engine sends a join-link message into the conversation so all participants see it.
4. The initiator's browser connects to the room using `new Room()` + `room.connect(url, token)` and enables camera and microphone via `localParticipant.enableCameraAndMicrophone()`.
5. Other participants click the link, receive their own tokens, and join the same room.
6. Each participant's video tile renders using `track.attach()`. Org directory metadata (avatar, name, location) is shown in each tile.

**Expected outcome**: All invited participants are in a live video session within 5 seconds of clicking the link. The room persists until all participants leave or the host ends it.

### US5 — Browse and message the org directory

**Actor**: YappChat user (web or mobile)

**Scenario**:

1. User opens the directory panel and sees a tree: their Company at root, Groups beneath it, and Individuals within each Group.
2. Each node shows its avatar, display name, and location.
3. User clicks an Individual and can see their status (online / offline / in a call) and open a direct message or start a video call with one click.
4. User clicks a Group and can broadcast a message to all members of that group, or start a group video call.
5. An admin adds a new team (Group) under a Company, assigns members (Individuals), sets the group avatar and location.

**Expected outcome**: The directory renders the full Company → Group → Individual tree. Clicking any node surfaces the message and video call actions. Changes made by admin propagate to all connected clients in real time via WebSocket.

### US6 — AI coding agent requests developer input and receives instructions

**Actor**: AI coding agent (e.g., Claude Code, Cursor, a custom LLM agent)

**Scenario**:

1. An AI coding agent is registered in YappChat via `POST /api/engine/agents`. It receives an `agentid` and an API token. The engine creates a dedicated YappChat internal channel for it and an `orgmembers` row with `isagent: true`, the agent's avatar, display name, and current task description.
2. The agent appears in the org directory under its assigned group (e.g., "AI Agents") with a status dot showing `working`.
3. During development, the agent encounters a decision point — it needs the developer to clarify an architecture choice. The agent calls `POST /api/engine/agents/:id/messages` with the message body (text, optionally a code snippet or file attachment).
4. The message appears in the agent's YappChat channel feed in real time. The developer sees the agent's avatar, name, and status `waiting_for_input`. They can read the agent's question in context — including any prior messages in the session.
5. The developer types a reply in the `AgentChannelPanel`. The engine delivers the reply to the agent's registered `callbackurl` via HTTP POST, and also records it in the `messages` table.
6. The agent receives the instruction, resumes work, and its status returns to `working`. It sends a follow-up confirmation back into the channel.

**Expected outcome**: The full conversation between agent and developer is visible in YappChat. The developer never has to leave YappChat to answer agent questions. The agent status is visible in the org directory at all times.

## Functional Requirements

### FR-001 — ChannelPlugin loading and lifecycle

The engine MUST load each of the 23 channel extensions via `defineBundledChannelEntry()` → `BundledChannelEntryContract` and manage the account lifecycle through `ChannelGatewayAdapter.startAccount()` / `stopAccount()`. No engine code should import platform-specific modules directly.

**Acceptance Criteria**:

- [ ] The engine discovers extensions by scanning `extensions/*/index.ts` and calling `loadChannelPlugin()` on each `BundledChannelEntryContract`
- [ ] `startAccount(ChannelGatewayContext)` is called for every enabled `channelaccounts` row at engine startup
- [ ] `stopAccount()` is called cleanly on shutdown or when a channel is disabled; the engine does not crash if one plugin's `startAccount` throws
- [ ] Adding a new extension folder with a valid `defineBundledChannelEntry()` export is sufficient to activate it — no engine source changes required

### FR-002 — Inbound message ingestion with ack/nack

Every inbound event MUST be wrapped in a `MessageReceiveContext<TMessage>` and passed through an explicit ack/nack lifecycle before being considered processed.

**Acceptance Criteria**:

- [ ] Each plugin raises inbound events as `MessageReceiveContext` objects with initial `ackState: "pending"`
- [ ] The engine persists the event to the `messages` table, then calls `ctx.ack()` — advancing `ackstate` to `"acked"`
- [ ] If persistence fails, the engine calls `ctx.nack(error)` — setting `ackstate` to `"nacked"` and logging the error; the adapter may redeliver
- [ ] Duplicate events (same `platformmessageid` + `channelid`) are detected before ack and silently dropped — the dedup check is the uniqueness constraint on those two columns
- [ ] Persisted inbound messages are pushed to connected WebSocket clients within 1 second of receipt

### FR-003 — Outbound send via ChannelMessageSendTextContext

The engine MUST accept outbound send requests, build `ChannelMessageSendTextContext` objects, and execute `sendDurableMessageBatch()` for delivery, storing the resulting `MessageReceipt` per channel.

**Acceptance Criteria**:

- [ ] `POST /api/engine/messages/send` accepts `{ content, channelIds[], mediaUrls[] }` and returns a message ID synchronously
- [ ] For each `channelId`, the engine resolves the plugin's `ChannelGatewayAdapter` and calls `sendDurableMessageBatch()` asynchronously
- [ ] The returned `MessageReceipt` fields (`primaryPlatformMessageId`, `platformMessageIds[]`, `sentAt`) are persisted in `messagedeliveries` with `ackstate: acked`
- [ ] If `sendDurableMessageBatch()` throws, the delivery row is marked `ackstate: nacked` and retried up to 3 times with exponential backoff

### FR-004 — Channel account snapshot and health probe

The engine MUST expose per-account health via `ChannelStatusAdapter.probeAccount()` and aggregate results into a `ChannelHealthSummary` accessible to the admin UI.

**Acceptance Criteria**:

- [ ] `GET /api/engine/channels/:id/health` calls `probeAccount()` on the relevant `ChannelStatusAdapter` and returns the resulting `ChannelAccountSnapshot`
- [ ] `GET /api/engine/channels` includes a `healthSummary` field per channel populated from the most recent `ChannelHealthSummary`
- [ ] Health probe failures are captured in `channels.lastseenat` and surfaced in the `ChannelHealthBadge` component
- [ ] `ChannelAccountSnapshot` status changes are pushed over WebSocket to subscribed admin clients

### FR-005 — Durable outbound queue for offline channels

When a channel's `startAccount()` has not yet succeeded or has called `stopAccount()`, outbound messages destined for it MUST be stored durably and delivered in order once the account comes online.

**Acceptance Criteria**:

- [ ] Pending `messagedeliveries` rows survive a server restart — they are in PostgreSQL, not only in memory
- [ ] On successful `startAccount()`, the engine replays all `ackstate: pending` delivery rows for that channel in `createdat` order via `sendDurableMessageBatch()`
- [ ] Inbound gaps during a disconnect are reconciled using `platformmessageid` — duplicates are dropped, gaps are logged

### FR-006 — Platform rate limit enforcement

The outbound pipeline MUST enforce per-platform send rate limits so individual adapter implementations do not need to handle them.

**Acceptance Criteria**:

- [ ] Slack channels are throttled to ≤ 1 message/second per channel target
- [ ] Discord channels are throttled to ≤ 5 messages/second
- [ ] Telegram channels are throttled to ≤ 30 messages/second
- [ ] Rate limit violations result in queuing (not dropping) — delivery is delayed, not lost
- [ ] The rate limit values are configurable in `channels.<platform>.rateLimit` within `OpenClawConfig`

### FR-007 — Video room lifecycle via OpenVidu 3.x

The engine MUST create, manage, and tear down video rooms using the self-hosted OpenVidu 3.x server (`livekit-client` SDK, Apache 2.0). Rooms are initiated from any YappChat conversation and persist until all participants leave.

**Acceptance Criteria**:

- [ ] `POST /api/engine/videorooms` creates a room record in the `videorooms` table and requests an OpenVidu session via the LiveKit REST API; returns `roomId` and a host token
- [ ] `POST /api/engine/videorooms/:id/join` issues a participant token scoped to that room and the caller's `orgmemberid`; roles: `host` or `participant`
- [ ] The browser client joins with `new Room()` + `room.connect(openViduWssUrl, token)` and publishes tracks via `localParticipant.enableCameraAndMicrophone()`
- [ ] Remote participant tiles render via `room.on('trackSubscribed', track => track.attach(el))`; each tile displays the participant's org avatar, display name, and location from the directory
- [ ] Screen sharing is supported via `localParticipant.setScreenShareEnabled(true)`
- [ ] `DELETE /api/engine/videorooms/:id` ends the room for all participants and marks the `videorooms` row `status: ended`
- [ ] A join-link message is automatically posted into the originating conversation when a room is created (uses FR-003 outbound pipeline)
- [ ] Fallback: if OpenVidu is unreachable, the engine returns a graceful error — it does not crash the messaging pipeline

### FR-008 — Org directory: Company → Groups → Individuals

The engine MUST maintain a three-level organizational hierarchy. Every node (company, group, individual) carries an avatar, display name, and location. The hierarchy drives message routing, video invites, and identity display.

**Acceptance Criteria**:

- [ ] `POST /api/engine/orgs` creates a company (root node) with `name`, `avatarurl`, `location`
- [ ] `POST /api/engine/orgs/:orgid/groups` creates a group under a company with `name`, `avatarurl`, `location`
- [ ] `POST /api/engine/orgs/:orgid/groups/:groupid/members` adds an individual to a group with `name`, `avatarurl`, `location`, `userid` (nullable for external contacts)
- [ ] `GET /api/engine/orgs/:orgid/tree` returns the full Company → Groups → Individuals tree in a single response, including avatar URL and location per node
- [ ] An individual can belong to multiple groups within the same company
- [ ] Sending a message to a `groupid` fans out to all `orgmembers` in that group via the outbound delivery pipeline (FR-003)
- [ ] Starting a video call with a `groupid` creates one room and issues tokens to all group members (FR-007)
- [ ] Directory changes (add/remove member, update avatar) are broadcast over WebSocket to all connected clients within 1 second

### FR-009 — Identity resolution across messaging and video

Every message and video room participant MUST be resolved to an org directory identity when one exists, so the same person is recognizable across platforms and video calls.

**Acceptance Criteria**:

- [ ] Each `messages` row MAY carry an `orgmemberid` FK — populated when the sender's `authorid` matches a known directory identity
- [ ] Each `videoroommembers` row MUST carry an `orgmemberid` FK — required for token issuance
- [ ] The `UnifiedMessageFeed` component displays the org avatar and display name for any message where `orgmemberid` is set, falling back to the raw platform `authorid` when not
- [ ] Identity matching is done by a configurable mapping: platform-type + platform-user-id → `orgmemberid`

### FR-010 — AI agent channel, identity, and dev communication

Any AI coding agent (Claude Code, Cursor, a custom LLM agent, or any HTTP-capable process) MUST be registerable as a first-class YappChat participant with its own channel, avatar, and real-time bidirectional messaging with developers.

**Acceptance Criteria**:

- [ ] `POST /api/engine/agents` registers an agent with `name`, `avatarurl`, `description`, `callbackurl` (the HTTP endpoint where the engine POSTs developer replies); returns `agentid` and a long-lived `apitoken`
- [ ] Registration automatically creates an `orgmembers` row with `isagent: true` and assigns it to a designated "AI Agents" group; it also creates a dedicated internal channel row in `channels` with `platformid: "yappchat-agent"`
- [ ] Agent appears in the org directory tree under the "AI Agents" group with its avatar, display name, and a live status dot: `working` | `waiting_for_input` | `paused` | `error`
- [ ] `POST /api/engine/agents/:id/messages` (authenticated by `apitoken`) sends a message from the agent into its channel — body supports `text`, optional `codeblock` (language + content), optional `attachmenturl`; the message appears in the `UnifiedMessageFeed` and `AgentChannelPanel` in real time
- [ ] `PATCH /api/engine/agents/:id/status` lets the agent update its status (`working`, `waiting_for_input`, `paused`, `error`) and current task description; change is broadcast over WebSocket to all connected clients within 1 second
- [ ] When a developer posts a reply in `AgentChannelPanel`, the engine records it in `messages` and HTTP-POSTs the reply JSON to the agent's `callbackurl` within 2 seconds; if delivery fails the engine retries 3 times with exponential backoff
- [ ] `GET /api/engine/agents/:id/messages` returns the full paginated message history for the agent channel — agent messages and developer replies interleaved in chronological order
- [ ] Multiple agents can run concurrently; each has its own channel, its own message history, and its own status visible in the directory
- [ ] An agent can be paused or deleted by an admin via `PATCH /api/engine/agents/:id` (`status: paused`) or `DELETE /api/engine/agents/:id`; deletion disconnects the channel and archives message history

### FR-011 — End-to-end encryption for YappChat-to-YappChat messages

All messages sent between YappChat clients (internal channels, agent channels, direct messages, group messages) MUST be end-to-end encrypted. The server stores only ciphertext — it cannot read the plaintext of any YappChat-to-YappChat message. External platform messages (Slack, Discord, etc.) conform to that platform's own encryption model; YappChat does not re-encrypt them.

**Acceptance Criteria**:

- [ ] Each YappChat user and agent generates a public/private key pair on first use (recommended: X25519 via `libsodium`). The public key is published to `userencryptionkeys`; the private key never leaves the client device
- [ ] Before sending an internal message, the sender encrypts the plaintext using the recipient's public key (for groups: a group session key distributed via sealed-sender envelopes). The `messages` row stores `encryptedpayload` (ciphertext) — the `content` column is NULL for encrypted messages
- [ ] `messages.encryptiontype` is set to `"e2e"` for YappChat↔YappChat, `"agent-e2e"` for agent channel messages, `"platform"` for messages bridged from external platforms (stored as-received)
- [ ] Any API response for a message with `encryptiontype: "e2e"` or `"agent-e2e"` returns only the ciphertext — decryption happens client-side only; no server-side route decrypts E2E content
- [ ] Key rotation: users may generate a new key pair. The engine publishes the new public key; the old key is marked `deprecated: true` and retained for decrypting historical messages until those messages are purged
- [ ] External platform messages are tagged `encryptiontype: "platform"` and stored as-received; YappChat makes no encryption claim about them — that platform's security model applies
- [ ] All engine API endpoints require TLS 1.2+ regardless of per-message encryption type

### FR-012 — User-controlled message retention with undelivered exemption

Each user controls how long their delivered messages are retained. Undelivered messages MUST NOT be purged regardless of the retention policy — they persist until successfully delivered. The default retention is forever (no purge).

**Acceptance Criteria**:

- [ ] Each user has a row in `userretentionpolicies` with `retentiondays` (integer, nullable — `null` = forever) and `appliedfrom` (timestamptz — policy applies to messages created after this point, never retroactively)
- [ ] On message insert, the engine sets `messages.purgeat = createdat + INTERVAL retentiondays days`; if retention is `null` or the message is not yet delivered, `purgeat` is NULL (never purge)
- [ ] A background job runs daily: hard-deletes all `messages` rows where `purgeat <= now()` AND `ackstate = "acked"`. Rows where `ackstate` is `"pending"` or `"nacked"` are NEVER touched by the purge job — undelivered messages persist until delivered regardless of age
- [ ] The same exemption applies to `messagedeliveries` rows — only rows with `ackstate = "acked"` are eligible for purge
- [ ] `PATCH /api/engine/users/:id/retention` sets `retentiondays` (1–3650) or `null` for forever. Takes effect for new messages only; existing messages are unaffected unless the user triggers a manual retroactive purge
- [ ] `POST /api/engine/users/:id/retention/purge` triggers an immediate purge of delivered messages beyond policy for that user — requires a `confirmationToken` in the request body to prevent accidents
- [ ] `GET /api/engine/users/:id/retention/status` returns counts: messages within policy, messages eligible for next scheduled purge, messages exempt (undelivered)
- [ ] Every purge event (scheduled or manual) is appended to `messageauditlog` with `userid`, `messagecount`, `purgedat`; audit log rows are retained 90 days and are not subject to user retention policy

### FR-013 — Multi-platform broadcast restricted to status messages only

Multi-channel simultaneous delivery (sending one message to more than one target at once) is reserved exclusively for **status messages**. Regular conversation messages (US1) are single-target only, bound to the active conversation context. This constraint prevents multi-platform targeting from being used as a broadcast or spam mechanism.

**Built-in status templates** (non-deletable):

| Template key | Default text |
| --- | --- |
| `out` | "I am out" |
| `in` | "I am in" |
| `meeting` | "In Meeting" |
| `brb` | "Be right back" |
| `dnd` | "Do not disturb" |

**Acceptance Criteria**:

- [ ] `POST /api/engine/messages/send` MUST reject any request where `channelIds[]` contains more than one entry AND `messagetype` is not `"status"`. The engine returns HTTP 422 with error `"multi_target_reserved_for_status"`. No delivery is attempted.
- [ ] `messages.messagetype` column distinguishes `"chat"` (single-target, default) from `"status"` (multi-target permitted). The schema enforces: if `messagetype = "chat"` then `channelIds` count must be exactly 1.
- [ ] `POST /api/engine/users/:id/status` sets the user's current status — accepts `{ templatekey, customtext?, expiresat? }`. The engine records the status in `userstatuses`, then fans a status message out to all channels listed in `userstatusbroadcastchannels` for that user using the existing FR-003 outbound pipeline with `messagetype: "status"`.
- [ ] `DELETE /api/engine/users/:id/status` clears the current status and optionally broadcasts a clearance message ("Andy Stapleton is back") to the same channel set.
- [ ] `GET /api/engine/users/:id/status` returns the current status text, template key, set-at timestamp, and expiry (if set).
- [ ] `POST /api/engine/users/:id/statustemplates` lets a user create a custom status template with `name`, `text`, optional `emoji`. Custom templates are stored in `statusmessagetemplates`.
- [ ] `GET /api/engine/users/:id/statustemplates` returns the user's custom templates merged with the built-in templates.
- [ ] `PATCH /api/engine/users/:id/statusbroadcastchannels` sets which channel IDs receive status broadcasts for this user — stored in `userstatusbroadcastchannels`. A user can include any combination of their connected channels, groups, or direct-message targets.
- [ ] If `expiresat` is set and the status has not been manually cleared, a background job clears it at that time and broadcasts the clearance.
- [ ] The user's current status text and emoji appear in `OrgNode` and `OrgMemberCard` alongside their avatar and name.
- [ ] Status messages received by the engine from external platforms (e.g., a Slack status update) are stored with `messagetype: "status"` and surfaced in the unified feed with a distinct visual treatment — not treated as a regular chat message.

### FR-014 — Message history: windowed load, background prefetch, scroll-back pagination, and text search

The conversation view MUST display recent history fast, fill in a wider window silently in the background, and load older history in 7-day chunks on demand as the user scrolls back. Messages MUST be full-text searchable, with a defined behaviour for E2E-encrypted content.

**Load strategy**:

| Phase | What | When | Time target |
| --- | --- | --- | --- |
| **Initial load** | Last 5 days of messages for the active conversation | On conversation open | ≤ 2 seconds to first render |
| **Background fill** | Days 6–30 | Immediately after initial render completes, silently | No spinner shown |
| **Scroll-back pagination** | Next 7 days (each hit of top) | User scrolls to the oldest visible message | ≤ 1 second per batch |

**Acceptance Criteria**:

- [ ] `GET /api/engine/conversations/:id/messages` uses **cursor-based pagination**. Required query params: `before` (ISO-8601 timestamp — return messages older than this), `days` (integer — how many days of window to return, max 7 for on-demand batches). Messages returned in descending `createdat` order (newest first); client reverses for display.
- [ ] Initial open: client calls `GET .../messages?before=now&days=5`. Response renders within 2 seconds including decryption of any E2E messages.
- [ ] Background fill: immediately after the initial render, client fires a second call `GET .../messages?before=<5-days-ago>&days=25`. This response is cached in the client message store — no loading UI is shown. If the call takes longer than the user scrolls back to that range, a loading indicator appears only at that point.
- [ ] Scroll-back pagination: when the user's scroll position reaches the top of the currently rendered message list, the client fires `GET .../messages?before=<oldest-currently-loaded-createdat>&days=7`. The response is prepended to the message list. **Scroll anchor is preserved** — the viewport MUST NOT jump when older messages are prepended; the oldest currently visible message stays on screen.
- [ ] Each prepended batch is preceded by a **date separator** showing the date range of that batch (e.g., "May 3 – May 9").
- [ ] If the user's retention policy window is shorter than the requested `days`, the engine returns only messages within the retention window; the response includes `retentionLimitReached: true` so the client can show "No older messages — retention policy limit reached."
- [ ] **Text search**: `GET /api/engine/conversations/:id/messages/search?q=<text>&limit=50` performs a PostgreSQL full-text search on `messages.content` using a GIN-indexed `tsvector` column. Returns matching messages with a 2-message context window before and after each match, sorted by `createdat DESC`.
- [ ] **E2E encrypted message search**: messages with `encryptiontype: "e2e"` have NULL `content` on the server — they CANNOT be searched server-side. The client performs local search against decrypted messages already in the client store. The search UI shows a banner: "Results from server (platform messages) and your local cache (encrypted messages). Encrypted messages older than 30 days may not appear."
- [ ] Search results highlight the matched term and link back to the message's position in the conversation scroll — clicking a result jumps to and highlights that message in the feed.
- [ ] A global search across all conversations (not just the active one) is out of scope for v1 — per-conversation search only.

**Database indexes required** (no new tables — additions to `messages`):

```sql
-- Windowed history queries
CREATE INDEX ON messages (conversationid, createdat DESC)
  WHERE ackstate = 'acked';

-- Full-text search on platform message content
CREATE INDEX ON messages USING GIN (to_tsvector('english', content))
  WHERE content IS NOT NULL;
```

## Data Requirements

New tables added by this scope. Naming follows project convention: plural, lowercase, no camelCase, no underscores. Primary keys are `id` UUID v7. Foreign keys match parent table name + `id`.

| Table | Purpose |
| --- | --- |
| `channels` | One row per registered channel instance (e.g., "Company Slack", "Support Discord") |
| `channelaccounts` | Platform credentials per channel — tokenSource `"env" \| "config" \| "none"`, enabled, config JSON |
| `messages` | Every normalized inbound and outbound message — ackstate, platformmessageid (dedup key) |
| `conversations` | Thread or room grouping within a channel |
| `messagedeliveries` | Per-channel delivery attempt for outbound — ackstate, retry count, error |
| `videorooms` | One row per video call session — OpenVidu session ID, status, originating conversation |
| `videoroommembers` | Participant record per person per room — token, join/leave timestamps, orgmemberid |
| `orgs` | Company (root directory node) — name, avatarurl, location |
| `orggroups` | Group under a company — name, avatarurl, location, orgid |
| `orgmembers` | Individual in one or more groups — name, avatarurl, location, userid, orgid, groupid |
| `orgidentitymap` | Maps platform-type + platform-user-id → orgmemberid for cross-channel identity resolution |
| `agents` | Registered AI coding agents — name, avatar, description, callbackurl, apitoken hash, status |
| `userencryptionkeys` | Public keys per user/device — X25519 public key, deprecated flag, createdat |
| `userretentionpolicies` | Per-user message retention setting — retentiondays (null = forever), appliedfrom |
| `messageauditlog` | Immutable purge audit trail — userid, messagecount, purgedat (retained 90 days) |
| `userstatuses` | Current active status per user — templatekey, statustext, emoji, expiresat |
| `statusmessagetemplates` | User-defined status templates — name, text, emoji |
| `userstatusbroadcastchannels` | Which channel IDs receive a user's status broadcasts |

### `channels`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `platformid` | text | e.g., `slack`, `discord`, `telegram` |
| `name` | text | Human label set by admin |
| `enabled` | boolean | Whether adapter should be connected at startup |
| `config` | jsonb | Platform-specific config (webhook URL, workspace ID, etc.) |
| `status` | text | `healthy` \| `degraded` \| `offline` |
| `lastseenat` | timestamptz | Last successful heartbeat |
| `createdat` | timestamptz | |

### `channelaccounts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `channelid` | uuid | FK → channels.id |
| `accountid` | text | Platform account identifier (e.g. Slack workspace ID) |
| `tokensource` | text | `"env"` \| `"config"` \| `"none"` — mirrors `SlackTokenSource` / per-platform pattern |
| `enabled` | boolean | Whether this account should be started at engine boot |
| `config` | jsonb | Platform-specific account config (token refs, workspace ID, etc.) |
| `createdat` | timestamptz | |

### `messages`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `channelid` | uuid | FK → channels.id |
| `conversationid` | uuid | FK → conversations.id (nullable) |
| `platformmessageid` | text | Platform's own message ID — dedup key (UNIQUE with channelid) |
| `authorid` | text | Platform user identifier of sender |
| `orgmemberid` | uuid | FK → orgmembers.id (nullable) — resolved identity |
| `encryptiontype` | text | `"e2e"` \| `"agent-e2e"` \| `"platform"` |
| `content` | text | Plaintext — NULL when `encryptiontype` is `"e2e"` or `"agent-e2e"` |
| `encryptedpayload` | bytea | Ciphertext — set for E2E messages, NULL for platform messages |
| `encryptionkeyid` | uuid | FK → userencryptionkeys.id — the recipient key used to encrypt |
| `mediaurl` | text[] | Attached media URLs; encrypted separately for E2E messages |
| `messagetype` | text | `"chat"` (single-target only) \| `"status"` (multi-target permitted) — default `"chat"` |
| `direction` | text | `inbound` \| `outbound` |
| `ackstate` | text | `pending` \| `acked` \| `nacked` — mirrors `MessageAckState` |
| `ackedat` | timestamptz | Nullable — set when `ctx.ack()` completes |
| `purgeat` | timestamptz | Nullable — computed from `createdat + retentiondays`; NULL = never purge or not yet acked |
| `createdat` | timestamptz | Mirrors `MessageReceiveContext.receivedAt` for inbound |

### `userencryptionkeys`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning YappChat user or agent ID |
| `deviceid` | text | Device or session identifier (one key pair per device) |
| `publickey` | text | Base64-encoded X25519 public key |
| `deprecated` | boolean | True when the user has rotated to a new key pair |
| `createdat` | timestamptz | |
| `deprecatedat` | timestamptz | Nullable |

### `userretentionpolicies`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning YappChat user ID |
| `retentiondays` | integer | Nullable — number of days to retain delivered messages; NULL = forever |
| `appliedfrom` | timestamptz | Policy applies to messages created at or after this timestamp |
| `updatedat` | timestamptz | |

### `messageauditlog`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | User whose messages were purged |
| `triggertype` | text | `"scheduled"` \| `"manual"` |
| `messagecount` | integer | Number of message rows deleted |
| `purgedat` | timestamptz | When the purge ran |
| `retentiondays` | integer | The policy in effect at purge time (nullable = forever) |

Rows in `messageauditlog` are retained for 90 days, then deleted by the same daily purge job. They are NOT subject to user retention policy.

### `userstatuses`

One row per user — their current active status. Replaced in-place on each status update.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning YappChat user |
| `templatekey` | text | Built-in key (`out`, `in`, `meeting`, `brb`, `dnd`) or `"custom"` |
| `statustext` | text | Resolved display text (may be from template or user-typed) |
| `emoji` | text | Optional emoji character or code |
| `setat` | timestamptz | When the status was set |
| `expiresat` | timestamptz | Nullable — background job clears status at this time |

### `statusmessagetemplates`

User-defined status templates. Built-in templates are not stored here — they are code constants.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user |
| `name` | text | Short label shown in the picker (e.g., "School run") |
| `statustext` | text | Full broadcast text (e.g., "Doing the school run, back at 9am") |
| `emoji` | text | Optional emoji |
| `createdat` | timestamptz | |

### `userstatusbroadcastchannels`

Which channels a user's status messages are broadcast to. A user opts in per channel.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user |
| `channelid` | uuid | FK → channels.id — the target channel for status broadcasts |
| `createdat` | timestamptz | |

UNIQUE constraint on `(userid, channelid)`.

### `videorooms`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `openvidusessionid` | text | OpenVidu / LiveKit session ID returned by the server |
| `conversationid` | uuid | FK → conversations.id — the chat this call was started from |
| `hostorgmemberid` | uuid | FK → orgmembers.id — who initiated the call |
| `status` | text | `active` \| `ended` |
| `startedat` | timestamptz | |
| `endedat` | timestamptz | Nullable |

### `videoroommembers`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `videoroomid` | uuid | FK → videorooms.id |
| `orgmemberid` | uuid | FK → orgmembers.id |
| `role` | text | `host` \| `participant` |
| `token` | text | LiveKit participant token (short-lived) |
| `joinedat` | timestamptz | |
| `leftat` | timestamptz | Nullable |

### `orgs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `name` | text | Company display name |
| `avatarurl` | text | Avatar image URL |
| `location` | text | City, region, or office label |
| `plantype` | text | `"individual"` \| `"corporate"` \| `"unset"` — written by spec 011 FR-001 on signup; spec 014 (Billing) reads this to determine pricing model |
| `seatlimit` | integer | Nullable. NULL = unlimited (corporate plan). `1` = individual plan (prevents accidental team onboarding into a personal org). Set by spec 011 FR-001 on signup; mutated by spec 014 on plan changes |
| `createdat` | timestamptz | |

### `orggroups`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `orgid` | uuid | FK → orgs.id |
| `name` | text | Group display name (e.g., "Engineering", "Sales") |
| `avatarurl` | text | Group avatar image URL |
| `location` | text | Location label for the group |
| `createdat` | timestamptz | |

### `orgmembers`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `orgid` | uuid | FK → orgs.id |
| `groupid` | uuid | FK → orggroups.id (primary group; member can appear in multiple groups) |
| `userid` | text | Nullable — linked YappChat user ID if the member has a login |
| `name` | text | Display name |
| `avatarurl` | text | Personal avatar image URL |
| `location` | text | City, office, or remote label |
| `status` | text | `online` \| `offline` \| `in_call` — set by engine in real time |
| `createdat` | timestamptz | |

### `orgidentitymap`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `orgmemberid` | uuid | FK → orgmembers.id |
| `platformid` | text | e.g., `slack`, `discord`, `telegram` |
| `platformuserid` | text | Platform-specific user identifier |
| `createdat` | timestamptz | |

UNIQUE constraint on `(platformid, platformuserid)`.

### `agents`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `orgmemberid` | uuid | FK → orgmembers.id — the directory identity for this agent (`isagent: true`) |
| `channelid` | uuid | FK → channels.id — the dedicated internal YappChat channel auto-created on registration |
| `name` | text | Display name shown in directory and message feed (e.g., "Claude Code — Auth Sprint") |
| `avatarurl` | text | Agent avatar image URL |
| `description` | text | Current task or purpose description — shown in directory tooltip |
| `callbackurl` | text | HTTP endpoint where engine delivers developer replies |
| `apitokenhash` | text | bcrypt hash of the long-lived API token issued on registration |
| `status` | text | `working` \| `waiting_for_input` \| `paused` \| `error` |
| `statusupdatedat` | timestamptz | When status last changed |
| `createdat` | timestamptz | |

> `orgmembers.isagent` flag (boolean, default `false`) is added to the `orgmembers` table by this scope to distinguish human individuals from AI agents. Both appear in the directory tree but agents render with a distinct badge.

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/engine/messages/send` | Send a message to one or more channels; returns message ID immediately, delivers async |
| GET | `/api/engine/messages` | List messages — filterable by `channelId`, `direction`, `since`, `conversationId` |
| GET | `/api/engine/messages/:id` | Fetch a single message with all delivery statuses |
| POST | `/api/engine/channels` | Register a new channel instance (platform + config) |
| GET | `/api/engine/channels` | List all channels with current health status |
| PATCH | `/api/engine/channels/:id` | Update channel config or toggle `enabled` |
| DELETE | `/api/engine/channels/:id` | Remove a channel and disconnect its adapter |
| POST | `/api/engine/channels/:id/test` | Trigger a connectivity test; returns pass/fail + error detail |
| GET | `/api/engine/channels/:id/health` | Current health status, last-seen timestamp, error detail |
| WS | `/ws/engine/messages` | Real-time inbound messages and delivery status stream |
| POST | `/api/engine/videorooms` | Create a video room — returns roomId + host token |
| POST | `/api/engine/videorooms/:id/join` | Issue participant token for a room — requires orgmemberid |
| GET | `/api/engine/videorooms/:id` | Fetch room status and participant list |
| DELETE | `/api/engine/videorooms/:id` | End room for all participants |
| WS | `/ws/engine/videorooms/:id` | Real-time room events (participant joined/left, track state) |
| POST | `/api/engine/orgs` | Create a company (root org) |
| GET | `/api/engine/orgs/:orgid/tree` | Full Company → Groups → Individuals tree with avatar + location |
| POST | `/api/engine/orgs/:orgid/groups` | Add a group under a company |
| PATCH | `/api/engine/orgs/:orgid/groups/:groupid` | Update group name, avatar, location |
| POST | `/api/engine/orgs/:orgid/groups/:groupid/members` | Add a member to a group |
| DELETE | `/api/engine/orgs/:orgid/groups/:groupid/members/:memberid` | Remove a member from a group |
| PATCH | `/api/engine/orgmembers/:id` | Update member name, avatar, location |
| POST | `/api/engine/orgidentitymap` | Map a platform user ID to an org member |
| POST | `/api/engine/agents` | Register an AI agent — returns agentid + apitoken; auto-creates org member + channel |
| GET | `/api/engine/agents` | List all registered agents with current status and last-message preview |
| GET | `/api/engine/agents/:id` | Agent detail — name, avatar, description, status, channelid, orgmemberid |
| PATCH | `/api/engine/agents/:id` | Update name, avatar, description, callbackurl, or status |
| DELETE | `/api/engine/agents/:id` | Deregister agent — disconnects channel, archives message history |
| POST | `/api/engine/agents/:id/messages` | **Agent → developer**: send a message to the agent channel (auth: apitoken). Body: `{ text, codeblock?: { language, content }, attachmenturl? }` |
| PATCH | `/api/engine/agents/:id/status` | **Agent self-report**: update status + task description (auth: apitoken) |
| GET | `/api/engine/agents/:id/messages` | Paginated message history for the agent channel — agent messages and developer replies interleaved |
| GET | `/api/engine/users/:id/encryption/keys` | List public keys for a user — for encrypting messages to them |
| POST | `/api/engine/users/:id/encryption/keys` | Publish a new public key (triggers key rotation; old key marked deprecated) |
| PATCH | `/api/engine/users/:id/retention` | Set retention policy — `{ retentiondays: number \| null }` |
| GET | `/api/engine/users/:id/retention/status` | Counts: messages within policy, eligible for purge, exempt (undelivered) |
| POST | `/api/engine/users/:id/retention/purge` | Trigger immediate manual purge — requires `{ confirmationToken }` in body |
| GET | `/api/engine/users/:id/status` | Get current status — templatekey, statustext, emoji, setat, expiresat |
| POST | `/api/engine/users/:id/status` | Set status — `{ templatekey, customtext?, emoji?, expiresat? }` — broadcasts to configured channels |
| DELETE | `/api/engine/users/:id/status` | Clear current status — optionally broadcasts clearance message |
| GET | `/api/engine/users/:id/statustemplates` | List built-in templates merged with user's custom templates |
| POST | `/api/engine/users/:id/statustemplates` | Create a custom status template — `{ name, statustext, emoji? }` |
| DELETE | `/api/engine/users/:id/statustemplates/:templateid` | Delete a custom template (built-ins cannot be deleted) |
| PATCH | `/api/engine/users/:id/statusbroadcastchannels` | Set which channelIds receive this user's status broadcasts |
| GET | `/api/engine/conversations/:id/messages` | Cursor-paginated message history — params: `before` (ISO timestamp), `days` (1–7 for on-demand, 25 for background fill) |
| GET | `/api/engine/conversations/:id/messages/search` | Full-text search within a conversation — params: `q`, `limit` (max 50). Returns matches with 2-message context window. |

## Frontend Components

### Messaging

| Component | Path | Description |
| --- | --- | --- |
| `ChannelList` | `src/ui/components/engine/ChannelList.tsx` | Scrollable list of all registered channels with health badge per row |
| `ChannelHealthBadge` | `src/ui/components/engine/ChannelHealthBadge.tsx` | Inline status chip: healthy (green) / degraded (amber) / offline (red) |
| `ChannelSetupWizard` | `src/ui/components/engine/ChannelSetupWizard.tsx` | Step-by-step wizard to select platform, enter credentials, and test connection |
| `UnifiedMessageFeed` | `src/ui/components/engine/UnifiedMessageFeed.tsx` | Chronological feed across all channels — shows org avatar + name when identity is resolved |
| `MessageComposer` | `src/ui/components/engine/MessageComposer.tsx` | Text input + channel or group multi-select + send; shows per-channel delivery receipts |
| `MessageHistoryView` | `src/ui/components/engine/MessageHistoryView.tsx` | Virtualised scrollable message list for a single conversation. Handles the three-phase load strategy: initial 5-day render, silent background fill to 30 days, 7-day on-demand batches on scroll-to-top. Preserves scroll anchor on prepend. |
| `MessageDateSeparator` | `src/ui/components/engine/MessageDateSeparator.tsx` | Full-width date label inserted between messages from different days and between each 7-day scroll-back batch |
| `MessageSearchBar` | `src/ui/components/engine/MessageSearchBar.tsx` | Search input within a conversation view. Debounced query → server full-text search + local E2E cache search merged. Renders result list with highlighted matches and jump-to links. Shows E2E-only-local banner when applicable. |
| `MessageSearchResult` | `src/ui/components/engine/MessageSearchResult.tsx` | Single search result row — excerpt with highlighted term, sender avatar, timestamp, "Go to message" link that scrolls to and highlights the message in the feed |
| `HistoryLoadIndicator` | `src/ui/components/engine/HistoryLoadIndicator.tsx` | Thin loading bar shown at the top of the feed only when a scroll-back batch is in flight; not shown during silent background fill |

### Video

| Component | Path | Description |
| --- | --- | --- |
| `VideoRoom` | `src/ui/components/video/VideoRoom.tsx` | Full video call view — grid of participant tiles plus controls bar |
| `VideoTile` | `src/ui/components/video/VideoTile.tsx` | Single participant tile — renders attached video track overlaid with org avatar, name, and location badge |
| `VideoControls` | `src/ui/components/video/VideoControls.tsx` | Mute, camera toggle, screen share, end call buttons |
| `VideoRoomLauncher` | `src/ui/components/video/VideoRoomLauncher.tsx` | "Start video call" button in any conversation; creates room and posts join-link message |
| `VideoJoinPrompt` | `src/ui/components/video/VideoJoinPrompt.tsx` | Renders the join-link message card in the feed with a "Join" CTA and live participant count |

### Org Directory

| Component | Path | Description |
| --- | --- | --- |
| `OrgDirectoryTree` | `src/ui/components/directory/OrgDirectoryTree.tsx` | Collapsible Company → Groups → Individuals tree panel |
| `OrgNode` | `src/ui/components/directory/OrgNode.tsx` | Single node — avatar, name, location, online/in-call status dot |
| `OrgNodeActions` | `src/ui/components/directory/OrgNodeActions.tsx` | Contextual action menu: Message, Video Call, View Profile |
| `OrgMemberCard` | `src/ui/components/directory/OrgMemberCard.tsx` | Expanded profile card — avatar, name, location, linked platform identities, activity status |
| `OrgAdminPanel` | `src/ui/components/directory/OrgAdminPanel.tsx` | Admin view to create/edit companies, groups, and members; assign platform identity mappings |

### AI Agents

| Component | Path | Description |
| --- | --- | --- |
| `AgentChannelPanel` | `src/ui/components/agents/AgentChannelPanel.tsx` | Full conversation view for one agent — shows interleaved agent messages and developer replies, with a reply composer at the bottom |
| `AgentMessageBubble` | `src/ui/components/agents/AgentMessageBubble.tsx` | Single message bubble — renders text, inline code block with syntax highlighting, or attachment link; agent messages are visually distinct from developer replies |
| `AgentStatusBadge` | `src/ui/components/agents/AgentStatusBadge.tsx` | Animated status indicator: `working` (spinner), `waiting_for_input` (pulsing amber), `paused` (grey), `error` (red) |
| `AgentCard` | `src/ui/components/agents/AgentCard.tsx` | Compact agent row in the directory tree — avatar, name, `AgentStatusBadge`, last-message preview, click to open `AgentChannelPanel` |
| `AgentListPanel` | `src/ui/components/agents/AgentListPanel.tsx` | Scrollable list of all registered agents sorted by most-recently-active; surfaced as a dedicated sidebar section alongside the org directory |
| `AgentRegistrationForm` | `src/ui/components/agents/AgentRegistrationForm.tsx` | Admin form to register a new agent — name, avatar upload, description, callback URL; displays the generated API token once on save |

### Status

| Component | Path | Description |
| --- | --- | --- |
| `StatusPicker` | `src/ui/components/status/StatusPicker.tsx` | Popover showing built-in templates + user custom templates; text field for custom text; optional expiry picker; confirm broadcasts to configured channels |
| `StatusBadge` | `src/ui/components/status/StatusBadge.tsx` | Inline chip showing current status emoji + text next to any avatar; appears in `OrgNode`, `OrgMemberCard`, `VideoTile`, and the user's own header |
| `StatusBroadcastConfig` | `src/ui/components/status/StatusBroadcastConfig.tsx` | Settings panel — checkbox list of connected channels to include in status broadcasts; saved to `userstatusbroadcastchannels` |
| `StatusTemplateManager` | `src/ui/components/status/StatusTemplateManager.tsx` | CRUD list of user-defined status templates — add, edit, delete custom templates; built-in templates shown as read-only |

## Success Criteria

1. A message sent via the engine appears on the target platform within 2 seconds under normal load.
2. A new channel adapter can be registered and active without changing engine source code.
3. All inbound messages from any platform are stored with the same normalized schema.
4. Engine handles at least 500 concurrent inbound messages per second without dropping.
5. Channel offline/reconnect is handled transparently — no outbound message loss.
6. A video call room is created and the first participant is connected within 5 seconds of clicking "Start video call."
7. The org directory tree (Company → Groups → Individuals with avatars and locations) renders correctly and updates in real time when an admin makes a change.
8. An AI coding agent can register, send a message into YappChat, and receive a developer reply delivered to its callback URL — all within 3 seconds end-to-end.
9. All YappChat-to-YappChat messages are end-to-end encrypted — no plaintext is stored on the server for internal messages.
10. Delivered messages older than a user's retention policy are purged on schedule. No undelivered message is ever purged.
11. A user can set a status and have it broadcast to all configured channels within 2 seconds. Any attempt to send a regular chat message to more than one target is rejected by the engine.
12. Opening a conversation renders the last 5 days of messages within 2 seconds. Scrolling to the top loads the next 7-day batch without the view jumping. Platform messages are full-text searchable; E2E messages are searched locally in the client.

## Key Entities

| Entity | Type / Location | Description |
| --- | --- | --- |
| `ChannelPlugin` | `packages/openclaw/src/channels/plugins/types.plugin.ts` | The full descriptor for one messaging platform — loaded via `defineBundledChannelEntry()`. Contains sub-adapters: `gateway`, `status`, `message`, `secrets`, etc. |
| `BundledChannelEntryContract` | `packages/openclaw/src/plugin-sdk/channel-entry-contract.ts` | Runtime handle returned by `defineBundledChannelEntry()`. Exposes `loadChannelPlugin()`, `setChannelRuntime()`, `register()`. One per `extensions/<platform>/index.ts`. |
| `ChannelGatewayAdapter` | `types.adapters.ts` | Sub-adapter on `ChannelPlugin.gateway`. Provides `startAccount(ctx)` / `stopAccount(ctx)` for the connection lifecycle. |
| `ChannelGatewayContext` | `types.adapters.ts` | Passed to every gateway call. Carries `cfg`, `accountId`, `account` (resolved), `runtime`, `abortSignal`, `setStatus()`. |
| `MessageReceiveContext` | `packages/openclaw/src/channels/message/receive.ts` | Wrapper around every inbound event. Fields: `id`, `channel`, `accountId`, `message`, `ackState` (`pending`\|`acked`\|`nacked`), `receivedAt`. Has `ack()` / `nack()` methods. |
| `ChannelMessageSendTextContext` | `packages/openclaw/src/channels/message/types.ts` | Input to every outbound send. Fields: `cfg`, `to`, `text`, `accountId`, `replyToId`, `threadId`, `signal`. |
| `MessageReceipt` | `packages/openclaw/src/channels/message/types.ts` | Result of a successful send. Fields: `primaryPlatformMessageId`, `platformMessageIds[]`, `parts[]`, `sentAt`. Stored in `messagedeliveries`. |
| `ChannelAccountSnapshot` | `types.adapters.ts` (via `ChannelStatusAdapter`) | Live health state of one account. Produced by `probeAccount()` and `buildAccountSnapshot()`. Aggregated into `ChannelHealthSummary`. |
| `ResolvedAccount` | per-extension `accounts.ts` (e.g. `ResolvedSlackAccount`) | Resolved credentials for one platform account. Always has `accountId`, `enabled`, token fields, and `tokensource: "env" \| "config" \| "none"`. |
| `Room` | `livekit-client` npm package | OpenVidu 3.x / LiveKit client-side room handle. Used via `new Room()` + `room.connect(url, token)`. Emits `participantJoined`, `trackSubscribed`, etc. |
| `LocalParticipant` | `livekit-client` | The local user's media publisher. Methods: `enableCameraAndMicrophone()`, `setMicrophoneEnabled()`, `setCameraEnabled()`, `setScreenShareEnabled()`. |
| `OrgNode` | domain model | Any node in the directory tree — could be an `orgs`, `orggroups`, or `orgmembers` row. Always has `name`, `avatarurl`, `location`. |
| `Agent` | `agents` table + `orgmembers` row (`isagent: true`) | A registered AI coding agent. Has its own dedicated internal `channels` row (`platformid: "yappchat-agent"`), an API token for inbound posting, and a `callbackurl` for receiving developer replies. Status is one of `working`, `waiting_for_input`, `paused`, `error`. |
| `UserEncryptionKey` | `userencryptionkeys` table | One X25519 key pair per user/device. Only the public key is stored server-side. Used to encrypt outbound messages before persistence. |
| `RetentionPolicy` | `userretentionpolicies` table | Per-user setting controlling how many days delivered messages are kept. `null` = forever. Undelivered messages are always exempt from purge. |

## Constraints

- Platform adapters requiring native binaries or OS-specific runtimes (WhatsApp/Baileys, iMessage) MUST fail gracefully — the engine keeps running when one adapter cannot load.
- Rate limits MUST be enforced by the engine: Slack ≤ 1 msg/s per channel, Discord ≤ 5 msg/s, Telegram ≤ 30 msg/s. Individual adapters do not need to handle this.
- Message deduplication REQUIRED — adapters fire duplicate events on reconnect; the engine drops duplicates silently via the UNIQUE constraint on `(platformmessageid, channelid)`.
- **E2E encryption is mandatory for all YappChat-to-YappChat messages.** The server MUST NOT store plaintext for internal messages. No server-side route may decrypt E2E content. External platform messages conform to their own platform's encryption model — YappChat does not override it.
- **Undelivered messages MUST NOT be purged** — the retention policy purge job may only touch rows with `ackstate = "acked"`. This applies to `messages` and `messagedeliveries` alike.
- **Default retention is forever** — `retentiondays = null` until the user explicitly sets a policy. No message is deleted without user instruction or delivery confirmation.
- Private encryption keys MUST remain client-side only — never transmitted to or stored by the server. The server holds only public keys in `userencryptionkeys`.
- All engine API endpoints require TLS 1.2+.
- AI response generation, skill invocation, document export, avatar UI, user auth/login, billing, and analytics are OUT OF SCOPE.
- **Multi-target sending is restricted to `messagetype: "status"` only.** The engine MUST enforce this at the API layer — `POST /api/engine/messages/send` with `channelIds.length > 1` and `messagetype !== "status"` MUST be rejected with HTTP 422. No bypass.
- **E2E messages cannot be searched server-side.** `messages.content` is NULL for `encryptiontype: "e2e"` — the full-text search index only covers platform messages. Clients are responsible for local decrypted-cache search and MUST surface the limitation clearly in the UI.
- History pagination uses cursor-based `before` timestamps — offset-based pagination (`page`, `skip`) is NOT supported; it produces inconsistent results when new messages arrive.
- The `days` parameter on the history endpoint is capped at 7 for scroll-back on-demand requests; the background fill uses 25. Requests exceeding 7 days (except the pre-authorised 25-day background call) are rejected with HTTP 422.
- The engine MUST NOT depend on any other YappChat scope module (002–007) — dependency is strictly one-way.

## Notes

### Code already in the repo

| What | Location |
| --- | --- |
| `ChannelPlugin` type | `packages/openclaw/src/channels/plugins/types.plugin.ts` |
| `ChannelGatewayAdapter` / `ChannelGatewayContext` | `packages/openclaw/src/channels/plugins/types.adapters.ts` |
| `MessageReceiveContext` | `packages/openclaw/src/channels/message/receive.ts` |
| `ChannelMessageSendTextContext`, `MessageReceipt` | `packages/openclaw/src/channels/message/types.ts` |
| `ChannelStatusAdapter`, `ChannelAccountSnapshot` | `packages/openclaw/src/channels/plugins/types.adapters.ts` |
| `ChannelHealthSummary`, `HealthSummary` | `packages/openclaw/src/commands/health.types.ts` |
| `defineBundledChannelEntry`, `BundledChannelEntryContract` | `packages/openclaw/src/plugin-sdk/channel-entry-contract.ts` |
| `OpenClawConfig` + `ExtensionChannelConfig` | `packages/openclaw/src/config/types.openclaw.ts` + `types.channels.ts` |
| `ResolvedSlackAccount` pattern | `extensions/slack/src/accounts.ts` (identical pattern in each extension) |
| Gateway send flow | `packages/openclaw/src/gateway/server-methods/send.ts` |
| 23 channel extensions | `extensions/slack/`, `extensions/discord/`, … each has `index.ts` with `defineBundledChannelEntry()` |

### OpenVidu 3.x / LiveKit — video stack

| Item | Detail |
| --- | --- |
| **Primary SDK** | `livekit-client` (npm) — full TypeScript, Apache 2.0. Install: `npm i livekit-client` |
| **Server** | OpenVidu 3.x Community — self-hosted via Docker Compose. All-in-one: LiveKit + mediasoup + MinIO + Redis + MongoDB + Caddy (auto-SSL). |
| **Docker Compose** | Official setup at `openvidu.io/docs/self-hosting/single-node/on-premises/install` |
| **Min server spec** | 4 CPU, 4 GB RAM, public IP, ports TCP 80/443, UDP 443, TCP 7881, UDP 50000-60000 |
| **Capacity (Community)** | ~50 simultaneous rooms of 8 participants on a 4-CPU node |
| **Token issuance** | Backend-only — use LiveKit Node SDK (`livekit-server-sdk`) to mint `AccessToken` per participant |
| **Room connect** | `await room.connect(openViduWssUrl, accessToken)` |
| **Publish tracks** | `await room.localParticipant.enableCameraAndMicrophone()` |
| **Subscribe tracks** | `room.on('trackSubscribed', (track) => track.attach(el))` |
| **Screen share** | `await room.localParticipant.setScreenShareEnabled(true)` |
| **Fallback option** | Jitsi Meet + `@jitsi/react-sdk` (Apache 2.0) if OpenVidu self-hosting is blocked — weaker TypeScript support but larger community (29k stars) |
| **License** | OpenVidu Community: Apache 2.0. OpenVidu Pro: commercial (needed for multi-node / horizontal scale) |

### Risks

- WhatsApp (`@whiskeysockets/baileys`) and iMessage require native binaries / macOS; the engine must catch `startAccount()` failures and mark those accounts `offline` without crashing.
- Rate limits are implicit in each adapter's API error handling today (e.g., Slack `rate_limited` error code) — the engine layer needs an explicit throttle wrapper for FR-006.
- The OpenClaw gateway send flow (`sendDurableMessageBatch`) is coupled to `OpenClawConfig`. YappChat will need a config bridge for FR-003.
- OpenVidu Community is single-node only — horizontal scaling requires Pro licence. Plan capacity accordingly for v1.
- LiveKit participant tokens are short-lived (default 6 hours). The backend must re-issue tokens for long-running rooms or participants who reconnect.
- **Key management complexity**: if a user loses their private key (clears browser storage, loses device), they cannot decrypt historical E2E messages. **Resolved by spec 010** — encrypted key backup with passphrase / 24-word recovery code, plus QR-based cross-device handoff. Server never sees plaintext.
- **Group E2E key distribution**: encrypting to a group requires a group session key sent to each member. If the group grows, new members cannot read historical messages encrypted with the old session key. Decide the policy (no history for new members, or re-encrypt on join) before implementation. Spec 010 FR-007 covers session-key inclusion in encrypted backups so a recovered user retains access to historical group messages they were part of; the new-member policy itself remains an open decision.
- **External platform messages stored as-received**: Slack, Discord, and similar platforms control their own encryption. YappChat cannot provide E2E guarantees for bridged messages — this must be communicated clearly to users.
- **Purge job is destructive and irreversible**: once messages are hard-deleted they are gone. The `messageauditlog` records the count but not the content. Ensure users understand this before enabling a retention policy shorter than forever.

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | What business problem does this solve? | Each feature in YappChat would otherwise need to know about every messaging platform. The chat engine provides one normalized Message type and one send/receive API so every other module — personal assistant, AI chat, AI avatar — talks only to the engine, not to Slack, Discord, etc. directly. |
| 2 | Who are the primary and secondary actors? | Primary actor: YappChat user (web or mobile). Secondary actors: AI agent / personal assistant, External platform users (Slack, Discord, etc.), YappChat administrator. |
| 3 | What is in scope? | IN SCOPE: normalized Message schema; ChannelAdapter plugin interface; inbound ingestion pipeline; outbound delivery pipeline; channel health monitoring; message persistence; send-to-multiple-channels API; real-time delivery via WebSocket to connected YappChat clients. OUT OF SCOPE: AI response generation (scope 005); skill execution (scope 002); document generation (scope 006); avatar rendering (scope 007); WebSocket engine internals (scope 003). |
| 4 | What is out of scope? | AI reply generation, skill/agent invocation, document export, avatar UI, user authentication, billing, and analytics dashboards. |
| 5 | How is success measured? | A message sent via the engine appears on the target platform within 2 seconds under normal load. A new channel adapter can be registered and active without changing engine source code. All inbound messages from any platform are stored with the same normalized schema. Engine handles at least 500 concurrent inbound messages per second without dropping. Channel offline/reconnect is handled transparently — no message loss for queued outbound. |
| 6 | What existing workflow must this align with? | YappChat already has 23 channel extensions copied from OpenClaw at extensions/ (Slack, Discord, Telegram, etc.). Each extension exposes a ChannelPlugin interface. The engine must wrap these extensions, providing lifecycle management (connect, disconnect, reconnect) and routing all messages through a single normalized bus. The mcp-server PostgreSQL DB (Drizzle ORM) is available for persistence. |
| 7 | What constraints or risks matter right now? | Some platforms (WhatsApp via Baileys, iMessage) require native binaries or macOS-only runtimes — the engine must degrade gracefully when a platform is unavailable. Rate limits vary per platform (Slack: 1 msg/s per channel; Discord: 5 msg/s; Telegram: 30 msg/s). Message deduplication is required because some adapters fire duplicate events on reconnect. |
