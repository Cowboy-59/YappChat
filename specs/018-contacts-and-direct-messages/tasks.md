# Spec 018 — Tasks

| ID | Task | FR | Status |
|----|------|----|--------|
| T001 | `contacts` + `contactinvites` schema + migration 0018 (applied) | FR-001/006 | ✅ done |
| T002 | Contacts service (search, request, respond, list, areContacts) | FR-001/002/005 | ✅ done |
| T003 | Email-invite (SES) + `acceptContactInvite` landing | FR-006 | ✅ done |
| T004 | Group chat creation + Chats inbox listing | FR-004 | ✅ done |
| T005 | API routes `/api/contacts/*`, `/api/chats` | FR-001..006 | ✅ done |
| T006 | DM send-gating in engine `sendMessage` (accepted-only) | FR-003 | ✅ done |
| T007 | Chats UI (`ChatsApp`, new-chat modal) + `/chats` + rail icon | FR-007 | ✅ done |
| T008 | Community "Ask to connect" (author click → request) | FR-002/007 | ✅ done |
| T009 | **Live end-to-end test** (connect → accept → DM → group, 2 accounts) | all | ⬜ pending |

## Safe-Fix Delta — approved 2026-07-01 (see spec.md "Delta — Approved 2026-07-01")

| ID | Task | FR | Status |
|----|------|----|--------|
| T012 | Engine-route membership gate + WS private-tier scope isolation | FR-018-A1/A2 | ✅ done (06-30, uncommitted) |
| T013 | Contacts schema rework (`usera`/`userb`, drop pair index, partial active-pair unique index) + `contactfreezes` table | FR-018-2.x/70.x | ⬜ in progress |
| T014 | Migration 0020 with **ordered-pair reconciliation** (keep accepted, decline pending) BEFORE the partial unique index | FR-018-2.3 | ⬜ in progress |
| T015 | Contacts service rework: derived-accepted, immutable rows, opposite-dir auto-accept, 24h decline purge | FR-018-2.x | ⬜ in progress |
| T016 | Invite hardening: email-bound + verified-email + consume-first atomic accept | FR-018-3.x (FR-006) | ⬜ in progress |
| T017 | Flood guard: rolling trip, durable freeze, digest sysadmin notify, `contact_flood`/`contact_unfreeze` audit | FR-018-70..76 | ⬜ in progress |
| T018 | Sysadmin freeze review + unfreeze endpoints + `/admin` panel | FR-018-77 | ⬜ in progress |
| T019 | Group-chat creation transaction wrap (atomic all-or-nothing) | FR-018-G | ⬜ in progress |
| T020 | People-search rate-limit (429 + retryAfterSec) | FR-018-S | ⬜ in progress |
| T021 | Unit tests + tsc/eslint/vitest green | all safe-fix | ⬜ pending |

**Deferred (delta revision + Legal):** block/unfriend (§4), @mention→PM (§6), escrow encryption (§7), illegal-activity monitoring (§8), public/private tiers (§1). See `PROPOSED-DELTA.md` + its 30 appended findings.

Built ahead of spec on 2026-06-28; spec written retroactively to match (see [[feedback_spec_first_always]] — do not repeat). Code verified (tsc/eslint); functional test outstanding.
