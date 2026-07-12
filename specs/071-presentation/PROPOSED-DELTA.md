# Proposed Delta — Spec 071 Presentation

**Change**: Harden the recording pipeline — take control of LiveKit egress instead of depending on the webhook + Cloud S3 handoff.
**Date**: 2026-07-02
**Status**: approved (2026-07-02) → implementing
**Motivation**: Recording is unreliable and opaque. Today `startRoomEgress` is fire-and-forget (its result is discarded), the "Recording" badge is keyed only on `status === 'live'` so it shows even when egress never started, and the produced file's URL only reaches the app if the LiveKit **webhook** fires and is configured. Getting the S3 location back out of LiveKit is painful and the resulting URL often won't play (key/format mismatch on presign). We own the S3 bucket (`yappchat-chat-media`), so we should own the result: capture the egress lifecycle, **pull the finished file ourselves on End**, and drive an honest in-app indicator.

---

## FR-023 — Controlled, observable presentation recording

The system MUST capture and expose the LiveKit egress lifecycle rather than fire-and-forget it, and MUST retrieve the finished recording by actively querying LiveKit (not solely by waiting for a webhook).

### Egress lifecycle capture (start)
- On **Go live**, `startRoomEgress` MUST return the LiveKit egress id (or the error). The engine persists `egressid`, sets `egressstatus = 'active'`, and clears `egresserror`. If the start call errors, it persists `egressstatus = 'failed'` and `egresserror = <message>` — and this surfaces to the host (no silent failure).

### Pull-on-End (primary) + webhook (fallback)
- On **End**, after closing the room, the engine MUST call LiveKit `ListEgress`/`GetEgress` for the room, read `fileResults[0]`, and `registerRecording` directly with the resolved S3 key + duration. The `egress_ended` webhook remains a secondary path.
- `registerRecording` MUST be **idempotent by `egressid`** so the pull and the webhook cannot create duplicate rows.

### Storage key normalization
- The stored `mediaurl` MUST be a **bare S3 key** relative to our bucket (strip any `s3://bucket/`, `https://…amazonaws.com/`, or leading slash), so `getReplay`'s `presignGet` against our own bucket always resolves to a playable URL.

### Honest recording indicator
- The host's in-room "Recording" state MUST reflect **real egress state**, not `status === 'live'`. A new host-only endpoint returns the current egress status; the room shows `Recording · mm:ss` (elapsed) when egress is active, or a visible error chip when it failed/never started.

### Data model — `presentations` (add)
| Column | Type | Notes |
|--------|------|-------|
| `egressid` | `text NULL` | LiveKit egress id captured at start. |
| `egressstatus` | `text NULL` | `starting` \| `active` \| `ended` \| `failed`. |
| `egresserror` | `text NULL` | Error message when start/finalize fails. |

### Data model — `presentationrecordings` (add)
| Column | Type | Notes |
|--------|------|-------|
| `egressid` | `text NULL` | Source egress id; UNIQUE-ish dedup key for idempotent register. |

Migration hand-authored + applied via `db-migrate.mjs` (additive, nullable).

### API
- `GET /api/presentations/:id/egress` — host-only. Returns `{ egressstatus, egressid, egresserror, startedat }` (and, when configured, a live `ListEgress` status refresh). Used by the room's recording indicator.

### LiveKit lib additions
- `startRoomEgress(pid): Promise<{ egressId: string | null; error: string | null }>` — parses the `StartRoomCompositeEgress` response.
- `getEgressInfo(pid, egressId?): Promise<{ status: string; fileKey: string | null; durationms: number | null; error: string | null } | null>` — via `EgressService.ListEgress` (twirp), reads the room's latest egress + `fileResults[0]`.
- `normalizeS3Key(location): string` — reduce any S3 URL/location to a bare key.

### Acceptance Criteria
- [ ] Going live captures a real `egressid`; a start failure sets `egressstatus='failed'` + `egresserror` and the host sees it.
- [ ] Ending a presentation retrieves the file via `ListEgress` and registers the recording even if the webhook never fires.
- [ ] The webhook and the pull cannot create two rows for the same egress (idempotent by `egressid`).
- [ ] `getReplay` returns a playable presigned URL because `mediaurl` is a normalized key in our bucket.
- [ ] The room's recording indicator reflects real egress state + an elapsed timer, and shows an error when egress is not running.

---

## tasks.md delta

| # | Task | Priority | Status |
|---|------|----------|--------|
| (T008b) | Recording hardening — capture egress lifecycle, pull-on-End retrieval, idempotent register, S3 key normalize, honest recording indicator (FR-023) | high | todo |
