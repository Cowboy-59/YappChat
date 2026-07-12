# Task Breakdown: Presentation — Live Screen-Share Presentations

**Feature**: Presentation — Live Screen-Share Presentations
**Spec**: 071
**Date Generated**: 2026-06-26
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Scope**: [../Project-Scope/071-live-broadcast-style-screen-share.md](../Project-Scope/071-live-broadcast-style-screen-share.md)

---

## Tasks

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Data model + migration | high | done |
| 2 | Scheduling + calendar API/service | high | done |
| 3 | Invitations + access control | high | done |
| 4 | Realtime room on spec 003 videoroom scope | high | done |
| 5 | Live media broadcast (LiveKit) | high | done |
| 6 | Captions + per-viewer translation | high | done |
| 7 | Chat + raise-hand Q&A | medium | done |
| 8 | Recording + access-scoped replay | medium | done |
| 9 | Frontend UI | high | done |
| 10 | Verification | high | done |
| 8b | Recording hardening — capture egress lifecycle, pull-on-End retrieval, idempotent register, S3 key normalize, honest recording indicator (FR-023, see [PROPOSED-DELTA.md](PROPOSED-DELTA.md)) | high | done (migration `0023_presentation_egress.sql` applied) |
| 11b | "Start now" instant presentation — title-only create dated now + route host into the room (FR-026, see [PROPOSED-DELTA-start-now.md](PROPOSED-DELTA-start-now.md)) | medium | done |

## Task Details

### T001 — Data model + migration

Add `presentations`, `presentationinvites`, `presentationattendees`, `presentationcaptions`, and `presentationrecordings` tables to the `yappchat` Postgres schema via Drizzle (kit naming: plural lowercase, UUID v7 `id`, FKs as `<parent>id`; `spokenlanguage` one of en/fr/es/de/pt default `en`; `visibility` public|private; `status` scheduled|live|ended|canceled). Generate migration SQL only (applied manually). Covers the data needs of FR-001/018/021.

### T002 — Scheduling + calendar API/service

Create the presentations service and Next.js routes: `POST/GET/PATCH/DELETE /api/presentations` for create/list/edit/cancel plus a calendar/list endpoint returning upcoming and past (with replay) sessions, access-filtered. Compute status from schedule; host = owner via spec 011 auth. FR-001/002/003.

### T003 — Invitations + access control

Implement `presentationinvites`: generate/revoke public and private invite links (unguessable tokens) and the join resolver enforcing visibility — public allows anonymous guests (display-name capture), private requires an invite + signed-in account — plus a capacity cap with a room-full response. FR-004/005/006/007.

### T004 — Realtime room on spec 003 videoroom scope

Extend the spec 003 `videoroom:{presentationid}` scope as its first consumer: participant joined/left/ended + `presence.in_call`, plus presentation events for the hand-raise queue and caption/chat relay, with subscription authorization for public/private/community access. Transport for FR-008..013.

### T005 — Live media broadcast (LiveKit)

Implement one-way presenter screen+audio broadcast to all attendees via **LiveKit** (presenter publishes, viewers subscribe; attendees watch-only) with host start/stop/end controls. Stand up LiveKit (self-host on ECS or LiveKit Cloud), wire token/room provisioning to the presentation, and meet the <5s join and 100-concurrent-viewer (hard cap) targets. FR-008/009/010.

### T006 — Captions + per-viewer translation (GROQ)

Pull presenter audio server-side (LiveKit Agents) into **GROQ Whisper** speech-to-text producing base-language caption lines, and **GROQ Llama** machine-translation per active viewer into en/fr/es/de/pt (default seeded from `users.preferredlanguage`) rendered beneath the base line; degrade gracefully with a "captions unavailable" indicator. Validate streaming latency against SC #2 (base <2s, translated <3s). FR-014/015/016/017.

### T007 — Chat + raise-hand Q&A

Add in-session text chat reusing the spec 001 engine and a raise/lower-hand control feeding an ordered host question queue with answered/dismissed states, delivered over the realtime room. FR-011/012/013.

### T008 — Recording + access-scoped replay

Capture screen+audio+captions for completed sessions, store recordings in S3, expose an access-scoped replay on the calendar (same access as live) with host delete, and define a retention policy. FR-018/019/020.

### T009 — Frontend UI

Build `PresentationsCalendar`, `SchedulePresentationForm` (cover image upload reusing the spec 068 S3 pattern), `PresentationRoom` (screen view + caption overlay + chat + raise-hand), `HostControls` (question queue), `CaptionSettings` (per-viewer on/off + language), `JoinScreen` (guest display-name / invite gate), and `ReplayPlayer`. FR-002/021 + room UX.

### T010 — Verification

Verify end-to-end: `tsc --noEmit`, eslint, vitest; an e2e covering schedule → public/private join → live screen+captions → raise-hand → record → access-scoped replay; access-control tests (private rejects non-invitees 100%, guests join public); and success-criteria timings (join <5s, captions <2s, translation <3s, queue <1s).
