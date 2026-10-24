# Task Breakdown: wxKanban Company Chat API

**Feature**: wxKanban Company Chat API
**Spec**: 093
**Date Generated**: 2026-10-24
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Tasks

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | T001 Consumer API guard: secret, rate limit and audit helper (FR-001, FR-007) | critical | todo |
| 2 | T002 POST /api/consumer/accounts: create or link by email, welcome email when new (FR-002) | high | todo |
| 3 | T003 Company group: POST /api/consumer/groups and PATCH seat limit (FR-003) | high | todo |
| 4 | T004 Group members: PUT and DELETE /api/consumer/groups/:orgid/members/:userid (FR-004) | high | todo |
| 5 | T005 Project rooms: POST /api/consumer/rooms and PUT/DELETE room members (FR-005) | high | todo |
| 6 | T006 Retire a room: conversations.retiredat, retire endpoint, list filter, post refusal on every path (FR-006) | high | todo |
| 7 | T007 Regression: existing consumer session, org and invitation behavior unchanged (FR-008) | high | todo |
| 8 | T008 Acceptance: US1 to US6 and the success metrics | high | todo |
| 9 | T009 (Amendment A) GET /api/consumer/accounts?email=: read-only account lookup (FR-002) | high | todo |
| 10 | T010 (Amendment A) Room owner cannot be removed: 409 owner_protected (FR-005) | high | todo |

## Task Details

### T001 — T001 Consumer API guard: secret, rate limit and audit helper (FR-001, FR-007)

One shared guard for every /api/consumer/* route: constant-time WXKANBAN_CONSUMER_SECRET check (401 otherwise), per-secret rate limit, and an authauditlog writer (endpoint, target ids, result, time; never the secret).

### T002 — T002 POST /api/consumer/accounts: create or link by email, welcome email when new (FR-002)

Uses provisionOrLookupUserByEmail; returns {userid, created}; when created, sends the welcome email with a set-password link through the existing reset token and mailer. Idempotent.

### T003 — T003 Company group: POST /api/consumer/groups and PATCH seat limit (FR-003)

Creates a corporate org owned by the given account with the given seat limit (owner role on the owner); PATCH updates the limit and refuses 409 below current members.

### T004 — T004 Group members: PUT and DELETE /api/consumer/groups/:orgid/members/:userid (FR-004)

Direct add or re-role (admin|member), no invitation; 409 seat_limit_reached with the missing count; owner cannot be removed or re-roled.

### T005 — T005 Project rooms: POST /api/consumer/rooms and PUT/DELETE room members (FR-005)

Creates the room in the owner's projects chat grouping (created if missing) with the members; returns {conversationid}; member add and remove.

### T006 — T006 Retire a room: conversations.retiredat, retire endpoint, list filter, post refusal on every path (FR-006)

Migration adds conversations.retiredat; POST /api/consumer/rooms/:id/retire; room lists hide retired rooms from non-owners; new messages refused on web, WebSocket and agent-token paths; owner keeps full history.

### T007 — T007 Regression: existing consumer session, org and invitation behavior unchanged (FR-008)

The existing /api/consumer/session, org and invitation tests pass unchanged; groups and rooms created in YappChatt still behave as before.

### T008 — T008 Acceptance: US1 to US6 and the success metrics

Live runs of US1-US6 against a test org; measure duplicates (20 calls), p95 under 500 ms, 0 retired-room leaks, one audit entry per call with no secret.

### T009 — T009 (Amendment A) GET /api/consumer/accounts?email=: read-only account lookup (FR-002)

Behind the same consumer guard. Looks the email up without provisioning: returns {exists, userid, displayName}; unknown → exists false, userid and displayName null; malformed → 400 invalid_email. Creates nothing and sends nothing. wxKanban uses it to show the admin which account the Create button would link before they confirm (SCOPE-144 decision D5, contract C1.0).

### T010 — T010 (Amendment A) Room owner cannot be removed: 409 owner_protected (FR-005)

DELETE /api/consumer/rooms/:id/members/:userid refuses the room's owner (conversationmembers.role = 'owner') with 409 owner_protected and changes nothing, matching the group rule in FR-004 (SCOPE-144 contract C1.8).
