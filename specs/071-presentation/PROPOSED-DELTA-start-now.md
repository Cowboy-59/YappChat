# Proposed Delta — Spec 071 Presentation

**Change**: Add "Start now" — launch an impromptu presentation immediately, alongside scheduling for later.
**Date**: 2026-07-02
**Status**: approved (2026-07-02) → implementing
**Motivation**: Today a presentation can only be *scheduled* for a future date/time (FR-001). Hosts often want to just go live right now (a quick demo, an ad-hoc call) without picking a time. "Start now" gives that path.

---

## FR-026 — Instant "Start now" presentation

The host MUST be able to create a presentation that begins immediately: the create form offers a **Start now** action that requires only a title, creates the presentation dated *now*, and takes the host straight into the room to go live.

- Reuses the existing create flow (`POST /api/presentations`) with `scheduledstart = now` — no new endpoint, no new data model. The caller becomes host exactly as with scheduling.
- After creation, the host is routed to the room (`/presentations/:id`), where the existing **Go live** control starts the broadcast + recording (FR-023). Going live is not auto-triggered, so recording only begins once the host is ready (e.g., has shared their screen).
- Scheduling for a future time (FR-001) is unchanged; "Start now" is an additional action on the same form, needing only a title (no date/time).

### Acceptance Criteria
- [ ] The schedule form offers a **Start now** action enabled with just a title.
- [ ] Start now creates a presentation with `scheduledstart ≈ now`, host = caller, and navigates the host into its room.
- [ ] The host can Go live immediately from the room; scheduling a future presentation still works unchanged.

---

## tasks.md delta

| # | Task | Priority | Status |
|---|------|----------|--------|
| (start-now) | "Start now" instant presentation — title-only create dated now + route host into the room (FR-026) | medium | todo |
