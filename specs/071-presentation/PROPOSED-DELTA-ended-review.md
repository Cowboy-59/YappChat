# Proposed Delta — Spec 071 Presentation

**Change**: Ended presentations open in view-only replay mode (no "could not join"); company admins can review a member's ended recording.
**Date**: 2026-07-02
**Status**: approved (2026-07-02) → implementing
**Motivation**: Opening an ended presentation (e.g. from the calendar) threw `presentation_ended` → "Could not join", making the already-built replay UI (FR-019) unreachable after the fact — even for the host. And a company admin had no way to review a team member's recording.

---

## FR-029 — Ended presentations are view-only replay, not an error

Opening an ENDED presentation MUST admit the caller in **view-only replay mode** (using the same access gate as live viewing) instead of erroring:
- No live media: the join returns `livekit: null` for ended presentations.
- The room renders the replay (poster/processing video + chat summary + title/status); the host controls ("Go live"/etc.) are hidden when ended.
- Replay viewers are exempt from the capacity cap.

## FR-030 — Company-admin recording review

A **company admin** (owner/admin of an org the host belongs to) MAY open and review a member's **ended** presentation — the recording, chat summary, and transcript — even for a private, non-community presentation they did not host or attend. This grant is **review-only** (ended presentations); it does NOT grant access to live sessions.

- Enforced in both `joinPresentation` (room) and `getPresentationForViewer` (recording + chat-summary fetches) so all replay surfaces authorize consistently.

### Acceptance Criteria
- [ ] Opening an ended presentation shows the replay + info (no "could not join"); the start button is not shown.
- [ ] The host can reopen and review their own ended presentation from the calendar.
- [ ] A community member/admin can review an ended community presentation.
- [ ] A company admin (owner/admin sharing an org with the host) can review a member's ended presentation, including a private standalone one; live access is unaffected.

---

## tasks.md delta

| # | Task | Priority | Status |
|---|------|----------|--------|
| (ended-review) | Ended = view-only replay + company-admin recording review (FR-029/030) | medium | done |
