# Task Breakdown: Common Chat Engine

**Feature**: Common Chat Engine
**Spec**: 001
**Date Generated**: 2026-06-09
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Tasks

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Core data model + normalized Message schema | high | done (core tables; directory/agents/keys/video deferred to their tasks) |
| 2 | ChannelPlugin lifecycle + inbound ingestion + outbound send (FR-001/002/003) | high | done (internal channel; 23 external plugins need extensions/) |
| 3 | Channel health, durable offline queue, rate limiting + reconnect (FR-004/005/006) | high | todo |
| 4 | Org directory + cross-platform identity resolution (FR-008/009) | high | todo |
| 5 | AI agent channels + developer communication loop (FR-010) | high | todo |
| 6 | E2E encryption + user-controlled retention + purge audit (FR-011/012) | high | todo |
| 7 | Video rooms via OpenVidu 3.x (FR-007) | medium | todo |
| 8 | Message history, search, status messages + WebSocket delivery (FR-013/014) | high | todo |
| 9 | Shared membership core: `conversationmembers` + `conversation:{id}` scope + membership-checked subscribe + `space` conversation kind | high | done + LIVE-VERIFIED (migration `0007` applied; `scripts/ws-conversation-e2e.mjs` 5/5: member subscribe accepted, non-member rejected, member-only delivery) |
| 10 | User-initiated message deletion — soft-delete tombstone, author + admin permissions, `DELETE /api/chats/messages/:id`, `message.deleted` WS broadcast, right-click UI (FR-015, see [PROPOSED-DELTA.md](PROPOSED-DELTA.md)) | high | done (migration `0022_message_delete.sql` applied) |

## Task Details

### T001 — Core data model + normalized Message schema

Create the engine's canonical tables per project DB conventions (plural lowercase, UUID v7 PKs, FK = parent+id): channels, channelaccounts, messages (channelid, conversationid, platformmessageid UNIQUE with channelid for dedup, authorid, orgmemberid, encryptiontype 'e2e'|'agent-e2e'|'platform', content nullable, encryptedpayload bytea, encryptionkeyid, mediaurl text[], messagetype 'chat'|'status', direction 'inbound'|'outbound', ackstate 'pending'|'acked'|'nacked', ackedat, purgeat, createdat), conversations, and messagedeliveries (per-channel outbound attempt with ackstate, retrycount, error). Define the normalized Message TypeScript type that mirrors MessageReceiveContext/ChannelMessageSendTextContext. Generate the Drizzle migration; hand off for manual apply per project rule. This is the foundation every other task and downstream spec consumes.

### T002 — ChannelPlugin lifecycle + inbound ingestion + outbound send (FR-001/002/003)

Implement the ChannelGatewayAdapter facade: load each channel extension via defineBundledChannelEntry()/BundledChannelEntryContract and manage accounts through startAccount()/stopAccount() with no engine code importing platform modules directly (FR-001). Inbound: accept MessageReceiveContext<TMessage> with ackState pending, persist to messages, call ctx.ack() to advance to acked, dedup on (channelid, platformmessageid), then publish over the WebSocket engine (FR-002). Outbound: build ChannelMessageSendTextContext scoped to a conversation's resolved targets, call sendDurableMessageBatch(), persist one messagedeliveries row per channel from the MessageReceipt (FR-003). Provide the engine send/receive API the rest of YappChat calls.

### T003 — Channel health, durable offline queue, rate limiting + reconnect (FR-004/005/006)

Implement ChannelAccountSnapshot + ChannelHealthSummary status (healthy|degraded|offline) with periodic heartbeat into channels.lastseenat and a health probe endpoint (FR-004). Durable outbound queue: messagedeliveries rows in ackstate pending survive disconnects; on stopAccount the account is marked degraded, startAccount retries with exponential backoff, and pending rows replay via sendDurableMessageBatch on reconnect with platformmessageid dedup for inbound gaps (FR-005). Enforce per-platform rate limits before send, queuing or deferring when a platform's limit would be exceeded (FR-006). Capture disconnect/reconnect timestamps in an audit log.

### T004 — Org directory + cross-platform identity resolution (FR-008/009)

Build the directory data model + APIs for a Company -> Groups -> Individuals tree (orgs, orggroups, orgmembers — each with name, avatarurl, location), including admin CRUD to add groups, assign members, and set avatars/locations, with changes broadcast to clients over WebSocket (FR-008). Implement identity resolution via orgidentitymap (platformtype + platform-user-id -> orgmemberid) so inbound messages resolve messages.orgmemberid and the same person is unified across channels and shown consistently in feeds, directory, and video tiles (FR-009).

### T005 — AI agent channels + developer communication loop (FR-010)

Implement AI coding agent registration: POST /api/engine/agents creates an agents row (name, avatar, description, callbackurl, hashed apitoken, status) + a dedicated internal yappchat-agent channel + an orgmembers row with isagent true under an AI Agents group. Agents post via POST /api/engine/agents/:id/messages (text + optional code/file), appearing in their channel feed in real time with status waiting_for_input; developer replies in the AgentChannelPanel are delivered to the agent's callbackurl via HTTP POST and recorded in messages, returning agent status to working. Bearer apitoken auth resolves the agent identity.

### T006 — E2E encryption + user-controlled retention + purge audit (FR-011/012)

Implement end-to-end encryption for all YappChat-to-YappChat messages (FR-011): userencryptionkeys stores per-user/device X25519 public keys (with deprecation on rotation); messages with encryptiontype e2e/agent-e2e store ciphertext in encryptedpayload (content NULL), with media encrypted separately; the server never holds plaintext for E2E messages. Implement user-controlled retention (FR-012): userretentionpolicies (retentiondays NULL = forever, default); a daily purge job deletes delivered messages past purgeat but EXEMPTS undelivered (ackstate pending) messages; every purge writes an immutable messageauditlog row (90-day retention, not subject to user policy).

### T007 — Video rooms via OpenVidu 3.x (FR-007)

Implement ad-hoc video rooms from any conversation (FR-007): videorooms (OpenVidu session id, status, originating conversationid) and videoroommembers (per-participant token, join/leave timestamps, orgmemberid). Create a room + request an OpenVidu session token via the livekit-client token API on the self-hosted OpenVidu 3.x server, post a join-link message into the conversation, and let participants connect with new Room()/room.connect(url, token) and enableCameraAndMicrophone(). Render tiles with track.attach() showing org directory avatar/name/location. Room persists until all leave or the host ends it.

### T008 — Message history, search, status messages + WebSocket delivery (FR-013/014)

Implement message history (FR-014): windowed initial load of a conversation, background prefetch of adjacent windows, scroll-back pagination, and text search across a user's messages, each conversation retaining scroll position + last-read marker. Implement status messages (FR-013): messagetype status is the ONLY message type permitted to fan out to multiple targets (multi-target chat is forbidden); userstatuses (current per-user status), statusmessagetemplates (user templates; built-ins are code constants), and userstatusbroadcastchannels (which channels receive a user's status) with expiry-driven clearing. Wire all inbound/outbound/status/directory events through spec 003's WebSocket engine for real-time delivery to connected clients.

### T009 — Shared membership core (cross-context foundation)

The membership + per-conversation routing layer every communication context (Company / Groups / Individuals — see `specs/design/communication-model.md`) reuses. Scope:
- **`conversationmembers`** table — `id` (v7), `conversationid` (FK conversations, cascade), `userid` (uuid, the member), `role` (default `member`), `lastreadat` (nullable, drives unread), `joinedat`; unique `(conversationid, userid)`. The single source for who's in a conversation; powers the member list, native fan-out, and subscribe authorization.
- **`conversation:{id}` WS scope** — add `scopes.conversation(id)` to the spec 003 event model; the engine publishes native messages to this scope (in addition to the existing `channel:{id}` scope during transition, so the current `/messaging` demo + `ws-e2e` keep working).
- **Membership-checked subscribe** — `ws.ts` authorizes a `conversation:{id}` subscription only when the caller has a `conversationmembers` row for that conversation (closes the open-subscribe gap that today leaves `channel:` scope unauthorized).
- **`space` conversation kind** — add `space` to the `conversationkind` enum (additive `ADD VALUE`, not a destructive rename of existing `channel` rows) for community rooms; `space` is the canonical "room" kind going forward, `channel` kind deprecated for new work.
- Engine helpers: `addConversationMember` / `listConversationMembers` / `isConversationMember`; migration generated, manual apply.

Consumed first by spec 017 (Communities, T001). Deliberately generic — no community-specific columns here.
