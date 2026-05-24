# Requirements Checklist: Spec 001 — Common Chat Engine

**Spec Number**: 001
**Last Updated**: 2026-05-10
**Source**: `specs/Project-Scope/001-common-chat-engine-that-receives.md`
**Status**: `draft — ready for human review`

---

## Specification Quality

- [x] Overview clearly states WHAT and WHY (not HOW)
- [x] User scenarios cover primary, secondary, and edge cases (US1 send, US2 receive, US3 disconnect/reconnect)
- [x] Functional requirements are numbered FR-001 through FR-006
- [x] Each FR has clear, testable acceptance criteria
- [x] Success criteria are measurable — all 5 have timing targets or quantified thresholds
- [x] Scope boundaries are explicit — IN SCOPE and OUT OF SCOPE listed
- [x] No `[NEEDS CLARIFICATION]`, TODO, or TBD markers remain
- [x] Integration context documented with exact file paths to existing code

---

## Actors

| Actor | Role |
| --- | --- |
| YappChat user (web or mobile) | Sends and reads messages via the engine |
| AI agent / personal assistant | Programmatic consumer of the send/receive API (scope 002) |
| External platform users | Slack, Discord, Telegram, etc. members whose messages arrive inbound |
| YappChat administrator | Registers channels, monitors health, reviews delivery logs |

---

## User Scenarios Review

| # | Name | Actor | Coverage |
| --- | --- | --- | --- |
| US1 | Send to one or more external channels | YappChat user | Happy path — outbound delivery via `ChannelMessageSendTextContext` → `MessageReceipt` |
| US2 | Receive from an external platform | External platform user | Inbound ingestion — `MessageReceiveContext` ack lifecycle |
| US3 | Disconnect and reconnect with no loss | System (automated) | Resilience — durable queue replay via `messagedeliveries` |

- [ ] Are there additional scenarios to cover? Candidates: media/file attachment send, admin enables/disables a channel, rate limit hit mid-send

---

## Functional Requirements Review

| # | Name | Key Behaviour | Status |
| --- | --- | --- | --- |
| FR-001 | ChannelPlugin loading and lifecycle | `defineBundledChannelEntry()` discovery; `startAccount`/`stopAccount` lifecycle | `draft` |
| FR-002 | Inbound ingestion with ack/nack | `MessageReceiveContext` → persist → `ctx.ack()`; dedup by `platformmessageid + channelid` | `draft` |
| FR-003 | Outbound send via ChannelMessageSendTextContext | `sendDurableMessageBatch()` → `MessageReceipt` stored in `messagedeliveries` | `draft` |
| FR-004 | Channel account snapshot and health probe | `probeAccount()` → `ChannelAccountSnapshot` → `ChannelHealthSummary` | `draft` |
| FR-005 | Durable outbound queue for offline channels | PostgreSQL-backed `messagedeliveries` replayed on `startAccount()` | `draft` |
| FR-006 | Platform rate limit enforcement | Slack ≤ 1/s, Discord ≤ 5/s, Telegram ≤ 30/s; queue not drop | `draft` |

- [ ] FR-001: Should the engine support hot-reload of a plugin without full restart?
- [ ] FR-002: What is the retry policy for `nacked` inbound events — redeliver from adapter or dead-letter?
- [ ] FR-003: Should `POST /api/engine/messages/send` support media attachments in v1 (via `ChannelMessageSendMediaContext`)?
- [ ] FR-004: How frequently should `probeAccount()` run passively — on-demand only or scheduled heartbeat?
- [ ] FR-006: Should rate limit config default values live in `OpenClawConfig` or be hardcoded per platform for v1?

---

## Data Schema Review

### Tables introduced by this scope

| Table | Purpose | Reviewed |
| --- | --- | --- |
| `channels` | Registered channel instances with platform ID, name, enabled flag, and health status | [ ] |
| `channelaccounts` | Per-channel credentials — tokenSource `"env" \| "config" \| "none"`, enabled, config JSON | [ ] |
| `messages` | Inbound and outbound message records with `ackstate`, `platformmessageid` (dedup key) | [ ] |
| `conversations` | Thread/room grouping within a channel | [ ] |
| `messagedeliveries` | Per-channel delivery attempt for outbound — `ackstate`, retry count, error | [ ] |

- [ ] Is `conversations` needed in v1 or can it be deferred to a follow-on scope?
- [ ] Should `messages.content` store plain text only, or also a raw platform-native payload (JSON) for replay fidelity?
- [ ] Does `channelaccounts` need a separate row per Slack workspace, or is one `channels` row per workspace sufficient?

---

## API Routes Review

| Method | Path | Purpose | Reviewed |
| --- | --- | --- | --- |
| POST | `/api/engine/messages/send` | Send to one or more channels | [ ] |
| GET | `/api/engine/messages` | List messages with filters | [ ] |
| GET | `/api/engine/messages/:id` | Fetch message + delivery statuses | [ ] |
| POST | `/api/engine/channels` | Register a channel | [ ] |
| GET | `/api/engine/channels` | List channels with health | [ ] |
| PATCH | `/api/engine/channels/:id` | Update config / toggle enabled | [ ] |
| DELETE | `/api/engine/channels/:id` | Remove channel | [ ] |
| POST | `/api/engine/channels/:id/test` | Test connectivity | [ ] |
| GET | `/api/engine/channels/:id/health` | Current account snapshot | [ ] |
| WS | `/ws/engine/messages` | Real-time inbound + delivery status stream | [ ] |

- [ ] Should `GET /api/engine/messages` be paginated in v1 or cursor-based?
- [ ] Is auth/JWT required on all engine routes in v1 or is this an internal-only API initially?

---

## Frontend Components Review

| Component | Path | Purpose | Reviewed |
| --- | --- | --- | --- |
| `ChannelList` | `src/ui/components/engine/ChannelList.tsx` | List channels with health badge | [ ] |
| `ChannelHealthBadge` | `src/ui/components/engine/ChannelHealthBadge.tsx` | Healthy / degraded / offline chip | [ ] |
| `ChannelSetupWizard` | `src/ui/components/engine/ChannelSetupWizard.tsx` | Add and configure a channel | [ ] |
| `UnifiedMessageFeed` | `src/ui/components/engine/UnifiedMessageFeed.tsx` | Chronological feed across all channels | [ ] |
| `MessageComposer` | `src/ui/components/engine/MessageComposer.tsx` | Compose + multi-channel send + receipts | [ ] |

- [ ] Is a UI needed in v1 or does the admin configure channels via config file / env vars initially?
- [ ] Does `UnifiedMessageFeed` need per-platform filtering in v1?

---

## Success Criteria Review

| # | Criterion | Threshold | Reviewed |
| --- | --- | --- | --- |
| 1 | Message send latency | Appears on target platform within 2 seconds under normal load | [ ] |
| 2 | Adapter extensibility | New adapter active without changing engine source code | [ ] |
| 3 | Inbound normalization | All inbound messages stored with the same normalized schema | [ ] |
| 4 | Throughput | Handles at least 500 concurrent inbound messages/second without dropping | [ ] |
| 5 | Resilience | Channel offline/reconnect — no outbound message loss | [ ] |

- [ ] Is 500 msg/s the right throughput target for YappChat v1? Consider expected user volume.
- [ ] Should criterion 4 be tested with a load test as part of QA gate, or is it aspirational for v1?

---

## Constraints Review

| Constraint | Source | Reviewed |
| --- | --- | --- |
| WhatsApp (Baileys) and iMessage require native binaries — engine must not crash if unavailable | Code analysis | [ ] |
| Rate limits enforced by engine, not by individual adapters | Design decision | [ ] |
| Deduplication by `platformmessageid + channelid` unique constraint | Design decision | [ ] |
| No dependency on scopes 002–007 — one-way dependency rule | Architecture | [ ] |
| AI reply generation, skill invocation, auth, billing out of scope | Scope boundary | [ ] |

---

## Integration Risk Register

| Risk | Mitigation | Reviewed |
| --- | --- | --- |
| OpenClaw `sendDurableMessageBatch()` is tightly coupled to `OpenClawConfig` | Build a YappChat config bridge that maps to `OpenClawConfig` shape | [ ] |
| WhatsApp/iMessage native binary failures at `startAccount()` | Catch and mark account `offline`; log; continue | [ ] |
| Platform rate limit responses (Slack `rate_limited` error) handled inside adapters today | Add engine-level throttle wrapper in FR-006 | [ ] |
| `extensions/` pnpm workspace symlinks require Node to resolve from each extension's `node_modules/` | Confirmed working — symlinks verified pointing to `packages/openclaw` | [x] |

---

## Open Questions

Record decisions here as they are made:

| # | Question | Decision | Date |
| --- | --- | --- | --- |
| 1 | Hot-reload of plugins without full restart needed in v1? | | |
| 2 | Nacked inbound events — redeliver from adapter or dead-letter queue? | | |
| 3 | Media send (`ChannelMessageSendMediaContext`) in v1 scope? | | |
| 4 | `probeAccount()` on-demand only or passive heartbeat? | | |
| 5 | Rate limit defaults in `OpenClawConfig` or hardcoded per platform for v1? | | |
| 6 | `conversations` table in v1 or deferred? | | |
| 7 | `messages.content` plain text only or include raw platform payload? | | |
| 8 | Admin UI needed in v1 or config-file only? | | |
| 9 | 500 msg/s throughput target — load-tested in QA or aspirational? | | |

---

## Readiness Gate

- [x] No placeholder markers remain in the spec
- [x] All 3+ user scenarios defined with real type names
- [x] All 6 FRs have specific acceptance criteria grounded in actual code
- [x] Data schema covers all entities with column-level detail
- [x] API routes cover full CRUD + WebSocket stream
- [x] Key Entities table references real TypeScript types and file paths
- [x] Integration risk noted with specific mitigations
- [ ] Open questions above answered by the team
- [ ] Scope approved for `createspecs`
