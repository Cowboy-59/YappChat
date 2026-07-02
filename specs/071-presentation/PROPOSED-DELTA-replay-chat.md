# Proposed Delta — Spec 071 Presentation

**Change**: Replay shows the video's first frame (poster) when ready; the in-session chat is persisted and an AI summary of the chat is shown beneath the replay video.
**Date**: 2026-07-02
**Status**: approved (2026-07-02) → implementing
**Motivation**: After a presentation, the replay currently renders a black `<video>` with no preview, and the in-session chat is ephemeral (delivered live only, never stored) so it's lost the moment the room closes. Hosts want to see a still of the recording before playing, and to review what was discussed in chat.

---

## FR-027 — Replay poster (first frame)

When a recording is ready, the replay player MUST present the video's **first frame** as a still preview (so it's visibly "ready to play"), with standard controls to play on demand — not a black box.

## FR-028 — Persist in-session chat + AI summary under the replay

- Every in-session chat message MUST be persisted (author name, optional userid, text, timestamp) — not only broadcast live.
- On the replay screen, **beneath the video**, the system MUST show a **summary of the chat session**: a short AI-generated recap plus access to the full transcript. When there was no chat, it says so.
- The summary is access-scoped exactly like the replay (same viewer rules).

### Data model — `presentationchatmessages` (new)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK (v7) | |
| `presentationid` | `uuid` NOT NULL → `presentations.id` ON DELETE cascade | |
| `userid` | `uuid NULL` | null for guests |
| `name` | `text` NOT NULL | display name at send time |
| `text` | `text` NOT NULL | message body |
| `createdat` | `timestamptz` NOT NULL default now | ordering |

Migration hand-authored + applied via `db-migrate.mjs` (additive).

### API
- `GET /api/presentations/:id/chat/summary` — access-scoped. Returns `{ summary: string | null, count: number, messages: Array<{ name, text, createdat }> }`. `summary` is a short GROQ-generated recap (null when there was no chat); `messages` is the full ordered transcript.

### Behavior
- `sendChat` persists each message (best-effort) in addition to the live publish.
- Summary is generated on demand from the saved transcript via the existing GROQ config (same key as captions); if GROQ is unconfigured or fails, the transcript still shows and `summary` is null.

### Acceptance Criteria
- [ ] A ready replay shows the first frame as a poster with working play controls.
- [ ] In-session chat messages are stored and returned in order for a presentation.
- [ ] The replay screen shows a chat summary + transcript beneath the video, access-scoped; empty chat shows an explicit "no chat" state.

---

## tasks.md delta

| # | Task | Priority | Status |
|---|------|----------|--------|
| (replay-chat) | Replay first-frame poster + persisted chat with AI summary beneath the video (FR-027/028) | medium | todo |
