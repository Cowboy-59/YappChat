# Scope 093: wxKanban Company Chat API

**Scope Number**: 093
**Status**: `draft`
**Created**: 2026-10-24
**Depends On**: wxKanban SCOPE-144 (Company YappChatt Account, the caller); YappChatt SPEC-090 (chat groupings); the existing consumer session (lib/consumer/wxkanban.ts)
**Source**: `specs/Project-Scope/093-wxkanban-company-chat-api.md`

## Overview
YappChatt adds a server-to-server API, used only by wxKanban with the shared consumer secret, that lets a wxKanban company own its chat: create or link the company account by email (a welcome email to set a password when new), create the company's corporate group with a seat limit from the wxKanban plan, add, remove and re-role group members directly (owner, admin, member), create project rooms owned by the company account with their members and change room membership, and retire old rooms (hidden from members, history kept for the owner). Every call is rate-limited and audited, and YappChatt's own groups, rooms and invitations are unchanged. wxKanban (SCOPE-144) needs every company to own its YappChatt account, group and project rooms, with the right people in them and kept in sync. Today YappChatt offers wxKanban only one server-to-server call, the consumer session; groups add people only by email invitations each person must accept, a personal org has one seat, rooms can gain members only when they are created, and a room cannot be retired. So wxKanban cannot create a company group, cannot keep membership in line, and cannot replace a room created under the wrong account. Without these endpoints SCOPE-144's account, group and room features cannot ship. This scope covers Server-to-server consumer endpoints for wxKanban only, behind WXKANBAN_CONSUMER_SECRET, rate-limited and audited: create or link an account by email (welcome email when new); create a corporate company group with a seat limit and update the limit; add, remove and re-role group members directly; create a room owned by the company account with members in its Projects area; add and remove room members; retire a room (hidden from members, history kept for the owner, posting refused). The retired-room state on conversations and the room-list filter. Any UI change beyond hiding retired rooms from lists. Billing. SSO. YappChatt's own invitation flow (unchanged for groups created in YappChatt). SCOPE-091 remote management. Moving messages between rooms.

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | The wxKanban server, acting for a company and calling with the consumer secret |
| **Secondary Actors** | The company account (group owner), wxKanban ADMINs (group admins), Company users and consulting members (members), New users receiving the welcome email |
| **Key Value** | wxKanban (SCOPE-144) needs every company to own its YappChatt account, group and project rooms, with the right people in them and kept in sync. Today YappChatt offers wxKanban only one server-to-server call, the consumer session; groups add people only by email invitations each person must accept, a personal org has one seat, rooms can gain members only when they are created, and a room cannot be retired. So wxKanban cannot create a company group, cannot keep membership in line, and cannot replace a room created under the wrong account. Without these endpoints SCOPE-144's account, group and room features cannot ship. |
| **Scope Boundary** | Server-to-server consumer endpoints for wxKanban only, behind WXKANBAN_CONSUMER_SECRET, rate-limited and audited: create or link an account by email (welcome email when new); create a corporate company group with a seat limit and update the limit; add, remove and re-role group members directly; create a room owned by the company account with members in its Projects area; add and remove room members; retire a room (hidden from members, history kept for the owner, posting refused). The retired-room state on conversations and the room-list filter. Any UI change beyond hiding retired rooms from lists. Billing. SSO. YappChatt's own invitation flow (unchanged for groups created in YappChatt). SCOPE-091 remote management. Moving messages between rooms. |


## User Scenarios & Testing

### US1 — wxKanban connects a new company

**Actor**: wxKanban server

**Scenario**:
1. It calls create-or-link account with info@acme.com; none exists, so YappChatt creates it, sends the welcome email and returns the user id.
2. It calls create group with seat limit 5; YappChatt creates a corporate org named for the company with that account as owner.
3. It adds 5 members, 1 of them as admin.

**Expected outcome**: The org exists with 6 seats used (owner plus 5) and roles exactly as sent; every call is in the audit log.

### US2 — The email already has an account

**Actor**: wxKanban server

**Scenario**:
1. It calls create-or-link with an email that already has a YappChatt account.

**Expected outcome**: The same user id comes back with created false; no duplicate account and no welcome email.

### US3 — A project room with its members

**Actor**: wxKanban server

**Scenario**:
1. It calls create room owned by the company account, titled 'Billing · KAIN', with 6 member ids.

**Expected outcome**: The room is in the account's Projects area and all 6 see it in their list.

### US4 — Membership changes

**Actor**: wxKanban server

**Scenario**:
1. It removes one user from the group and from 2 rooms, and changes another user's group role from member to admin.

**Expected outcome**: The removed user no longer sees those rooms or the group; the re-roled user can now invite people to common rooms.

### US5 — Retiring a room

**Actor**: wxKanban server

**Scenario**:
1. It calls retire room on an old room.

**Expected outcome**: The room is gone from members' lists; the owner can still open it with full history; posting to it is refused.

### US6 — Edge: no secret, or past the seat limit

**Actor**: Anyone

**Scenario**:
1. A call arrives without, or with a wrong, consumer secret.
2. A separate valid call would take the group past its seat limit.

**Expected outcome**: The first gets 401 with no change; the second gets 409 seat_limit_reached naming how many seats are missing; both are audited.

## Functional Requirements

### FR-001 — Only wxKanban can call the consumer API

Every new endpoint requires Authorization: Bearer <WXKANBAN_CONSUMER_SECRET>, compared in constant time, and is rate-limited per secret. A missing or wrong secret gets 401 and changes nothing.

**Acceptance Criteria**:
- [ ] A wrong secret gives 401 with no change.
- [ ] No endpoint answers a browser session.

### FR-002 — Create or link an account by email

POST /api/consumer/accounts {email, displayName} returns {userid, created}. A new account gets the welcome email with a set-password link; an existing one is returned unchanged.

**Acceptance Criteria**:
- [ ] Two calls with the same email give the same user id.
- [ ] The welcome email is sent only when created is true.
- [ ] (Amendment A) GET /api/consumer/accounts?email= returns {exists, userid, displayName} for that email and changes nothing: no account, no email, no audit row other than the call's own; an unknown email gives exists false with userid and displayName null; a malformed email gives 400 invalid_email.

### FR-003 — Company group

POST /api/consumer/groups {ownerUserid, name, seatlimit} creates a corporate org owned by that account; PATCH /api/consumer/groups/:orgid {seatlimit} updates the limit.

**Acceptance Criteria**:
- [ ] A new group is corporate with the given limit and the owner has the owner role.
- [ ] Lowering the limit below the current members refuses with 409 and changes nothing.

### FR-004 — Group members, directly

PUT /api/consumer/groups/:orgid/members/:userid {role: admin|member} adds or re-roles with no invitation; DELETE removes. The owner cannot be removed or re-roled.

**Acceptance Criteria**:
- [ ] Adding past the limit gives 409 seat_limit_reached with how many seats are missing.
- [ ] Removing the owner gives 409.

### FR-005 — Project rooms

POST /api/consumer/rooms {ownerUserid, title, memberIds} creates the room in the owner's Projects area (created if missing) and returns {conversationid}; PUT and DELETE /api/consumer/rooms/:id/members/:userid change membership.

**Acceptance Criteria**:
- [ ] The room is in the owner's Projects area and every listed member is in it.
- [ ] A removed member no longer sees it.
- [ ] (Amendment A) Removing the room's owner gives 409 owner_protected and changes nothing.

### FR-006 — Retire a room

POST /api/consumer/rooms/:id/retire marks it retired: hidden from members' lists, readable by the owner with full history, and new messages refused on every path (web, WebSocket, agent token).

**Acceptance Criteria**:
- [ ] After retiring, members do not see it.
- [ ] Posting to it is refused.
- [ ] The owner can still read every old message.

### FR-007 — Audit

Every consumer call writes an authauditlog entry: endpoint, target ids, result and time, never the secret.

**Acceptance Criteria**:
- [ ] Each US1 to US6 call leaves exactly one entry.

### FR-008 — Existing behavior unchanged

Groups and rooms created inside YappChatt, YappChatt's invitation flow, and the existing /api/consumer/session work exactly as before.

**Acceptance Criteria**:
- [ ] The existing consumer and org tests still pass unchanged.

## Data Requirements

YappChatt database, through YappChatt's own migration flow:
- `conversations`: add `retiredat` (timestamp, null = active). Room lists exclude retired rooms for everyone but the owner; posting checks it on every path.
- No other new tables: accounts use `users` (existing provisionOrLookupUserByEmail); groups use `orgs` + `orgmemberships`; rooms use `conversations` + `conversationmembers` in the owner's `projects` chat grouping; the welcome email uses `passwordresettokens` through the existing reset flow and mailer; audit uses `authauditlog`.
- Forbidden: storing or logging the consumer secret; any endpoint returning data from an org other than the one named.

## API Routes

All `Authorization: Bearer <consumer secret>`, server-to-server:

| Method | Path | What |
|---|---|---|
| POST | `/api/consumer/accounts` | Create or link by email → `{userid, created}`; welcome email if created (FR-002) |
| POST | `/api/consumer/groups` | Create corporate org `{ownerUserid, name, seatlimit}` → `{orgid}` (FR-003) |
| PATCH | `/api/consumer/groups/:orgid` | `{seatlimit}`; 409 if below current members (FR-003) |
| PUT | `/api/consumer/groups/:orgid/members/:userid` | `{role}` add or re-role; 409 `seat_limit_reached` (FR-004) |
| DELETE | `/api/consumer/groups/:orgid/members/:userid` | Remove; 409 for the owner (FR-004) |
| POST | `/api/consumer/rooms` | `{ownerUserid, title, memberIds}` → `{conversationid}` (FR-005) |
| PUT | `/api/consumer/rooms/:id/members/:userid` | Add a member (FR-005) |
| DELETE | `/api/consumer/rooms/:id/members/:userid` | Remove a member; 409 `owner_protected` for the room owner (FR-005, Amendment A) |
| GET | `/api/consumer/accounts?email=<email>` | Read-only lookup → `{exists, userid, displayName}`; nothing created (FR-002, Amendment A) |
| POST | `/api/consumer/rooms/:id/retire` | Retire (FR-006) |

Implementation follows the existing `/api/consumer/session` route and `lib/consumer/wxkanban.ts` (verifyConsumerSecret), with logic in `lib/consumer/` calling the existing orgs, engine and groupings services.

## Frontend Components

None, except that the room list query skips retired rooms for non-owners.

## Success Criteria

1. Secret-only: 0 consumer calls succeed without the right secret; 100% of wrong-secret calls get 401 and change nothing.
2. No duplicates: for 20 repeated create-or-link calls on one email, exactly 1 account and at most 1 welcome email.
3. Members as sent: after a sync, a company group's members and roles match what wxKanban sent, 100%; a seat-limit shortfall always returns 409 with the number of missing seats, never a partial add.
4. Retired means retired: 0 retired rooms shown to non-owners, 0 messages accepted into a retired room by any path, 100% of their history readable by the owner.
5. Fast enough for sync: each consumer call completes in under 500 ms at the 95th percentile, so wxKanban's 5-minute sync holds for a 50-person company.
6. Audit: 100% of consumer calls leave exactly one authauditlog entry; 0 entries contain the secret.
7. Nothing else breaks: 100% of the existing consumer-session, org and invitation tests pass unchanged.

## Key Entities

- **Company Group**: a corporate org created by wxKanban for one wxKanban company, owned by the company account, with a seat limit from the wxKanban plan.
- **Retired Room**: a conversation with `retiredat` set: hidden from members, readable by the owner, closed to new messages.

## Constraints

- MUST deliver only the behavior described within the scope boundary: Server-to-server consumer endpoints for wxKanban only, behind WXKANBAN_CONSUMER_SECRET, rate-limited and audited: create or link an account by email (welcome email when new); create a corporate company group with a seat limit and update the limit; add, remove and re-role group members directly; create a room owned by the company account with members in its Projects area; add and remove room members; retire a room (hidden from members, history kept for the owner, posting refused). The retired-room state on conversations and the room-list filter.
- MUST keep the following work out of scope for this iteration: Any UI change beyond hiding retired rooms from lists. Billing. SSO. YappChatt's own invitation flow (unchanged for groups created in YappChatt). SCOPE-091 remote management. Moving messages between rooms.
- MUST preserve guided, reviewable workflow decisions instead of relying on undocumented implementation assumptions.
- MUST keep user-visible outcomes aligned with the measurable success criteria defined in this scope.

## Notes

- Integration context: wxKanban SCOPE-144 Company YappChatt Account (the only caller; its FR-011 lists these endpoints and handles their absence). Existing YappChatt: POST /api/consumer/session and lib/consumer/wxkanban.ts (verifyConsumerSecret, provisionConsumerSession), lib/auth/service.ts (provisionOrLookupUserByEmail, requestPasswordReset), lib/auth/mailer.ts (sendEmail), lib/orgs/service.ts (orgs, inviteOrgMember, setOrgMemberRole, removeOrgMember), lib/engine/service.ts (addConversationMember), SPEC-090 chat groupings (projects grouping), tables users, orgs, orgmemberships, conversations, conversationmembers, chatgroupings, passwordresettokens, authauditlog. Related, not overlapping: YappChatt SCOPE-091 (remote management stub).
- Constraints and risks: Constraints: the YappChatt repo has 206 uncommitted changes from other work, so this scope's work goes in new files (app/api/consumer/*, lib/consumer/*) plus the smallest edits to existing ones (the conversations column, the room-list filter, the post check), listed for the owner before commit. Same secret as today (WXKANBAN_CONSUMER_SECRET, already on both App Runner services); no new credential. Deploys separately from wxKanban and ships before SCOPE-144's account and room features are switched on. The welcome email reuses the existing mailer and set-password token; no new email provider. Risks: a missed posting path for the retired check (high) — refusal required and tested on web, WebSocket and agent token; a misconfigured secret on one service (medium) — every call fails 401 loudly and audited, and wxKanban reports 'companion not available'; corporate plan meaning (low) — corporate implies only unlimited seats today; if billing is attached later, revisit the seat-limit choice. Compliance (SOC2): CC6.1 secret-only server-to-server access; CC6.3 least privilege (no endpoint returns data from another org); CC7.2 audit of every call. Notes: decided 2026-10-24; Q1 (b) when wxKanban creates the group, (a) when YappChatt does; Q2 (b) retired rooms hidden; Q3 (c) welcome email plus the wxKanban route; Q4 owner/admin/member; Q5 boundary as listed.
- Customer-visible or operator-visible history should be limited to outcomes that materially affect workflow review and support.
- **Amendment A (2026-10-24, owner-approved):** two additions from wxKanban SCOPE-144's frozen contract (specs/144-company-yappchatt-account/contracts.md in the wxKanban repo). (1) C1.0, GET /api/consumer/accounts?email=: a read-only lookup so a wxKanban ADMIN sees which account the Create button would link before confirming (SCOPE-144 owner decision D5); added to FR-002, task T009. (2) C1.8: removing a room's owner gives 409 owner_protected, the same rule the group already has (FR-004); added to FR-005, task T010.

## Clarifications

### Session 2026-10-24

| # | Question | Decision |
|---|----------|----------|
| 1 | What business problem does this solve? | wxKanban (SCOPE-144) needs every company to own its YappChatt account, group and project rooms, with the right people in them and kept in sync. Today YappChatt offers wxKanban only one server-to-server call, the consumer session; groups add people only by email invitations each person must accept, a personal org has one seat, rooms can gain members only when they are created, and a room cannot be retired. So wxKanban cannot create a company group, cannot keep membership in line, and cannot replace a room created under the wrong account. Without these endpoints SCOPE-144's account, group and room features cannot ship. |
| 2 | Who are the primary and secondary actors? | Primary actor: The wxKanban server, acting for a company and calling with the consumer secret. Secondary actors: The company account (group owner), wxKanban ADMINs (group admins), Company users and consulting members (members), New users receiving the welcome email. |
| 3 | What is in scope? | Server-to-server consumer endpoints for wxKanban only, behind WXKANBAN_CONSUMER_SECRET, rate-limited and audited: create or link an account by email (welcome email when new); create a corporate company group with a seat limit and update the limit; add, remove and re-role group members directly; create a room owned by the company account with members in its Projects area; add and remove room members; retire a room (hidden from members, history kept for the owner, posting refused). The retired-room state on conversations and the room-list filter. |
| 4 | What is out of scope? | Any UI change beyond hiding retired rooms from lists. Billing. SSO. YappChatt's own invitation flow (unchanged for groups created in YappChatt). SCOPE-091 remote management. Moving messages between rooms. |
| 5 | How is success measured? | Secret-only: 0 consumer calls succeed without the right secret; 100% of wrong-secret calls get 401 and change nothing. No duplicates: for 20 repeated create-or-link calls on one email, exactly 1 account and at most 1 welcome email. Members as sent: after a sync, a company group's members and roles match what wxKanban sent, 100%; a seat-limit shortfall always returns 409 with the number of missing seats, never a partial add. Retired means retired: 0 retired rooms shown to non-owners, 0 messages accepted into a retired room by any path, 100% of their history readable by the owner. Fast enough for sync: each consumer call completes in under 500 ms at the 95th percentile, so wxKanban's 5-minute sync holds for a 50-person company. Audit: 100% of consumer calls leave exactly one authauditlog entry; 0 entries contain the secret. Nothing else breaks: 100% of the existing consumer-session, org and invitation tests pass unchanged. |
| 6 | What existing workflow must this align with? | wxKanban SCOPE-144 Company YappChatt Account (the only caller; its FR-011 lists these endpoints and handles their absence). Existing YappChatt: POST /api/consumer/session and lib/consumer/wxkanban.ts (verifyConsumerSecret, provisionConsumerSession), lib/auth/service.ts (provisionOrLookupUserByEmail, requestPasswordReset), lib/auth/mailer.ts (sendEmail), lib/orgs/service.ts (orgs, inviteOrgMember, setOrgMemberRole, removeOrgMember), lib/engine/service.ts (addConversationMember), SPEC-090 chat groupings (projects grouping), tables users, orgs, orgmemberships, conversations, conversationmembers, chatgroupings, passwordresettokens, authauditlog. Related, not overlapping: YappChatt SCOPE-091 (remote management stub). |
| 7 | What constraints or risks matter right now? | Constraints: the YappChatt repo has 206 uncommitted changes from other work, so this scope's work goes in new files (app/api/consumer/*, lib/consumer/*) plus the smallest edits to existing ones (the conversations column, the room-list filter, the post check), listed for the owner before commit. Same secret as today (WXKANBAN_CONSUMER_SECRET, already on both App Runner services); no new credential. Deploys separately from wxKanban and ships before SCOPE-144's account and room features are switched on. The welcome email reuses the existing mailer and set-password token; no new email provider. Risks: a missed posting path for the retired check (high) — refusal required and tested on web, WebSocket and agent token; a misconfigured secret on one service (medium) — every call fails 401 loudly and audited, and wxKanban reports 'companion not available'; corporate plan meaning (low) — corporate implies only unlimited seats today; if billing is attached later, revisit the seat-limit choice. Compliance (SOC2): CC6.1 secret-only server-to-server access; CC6.3 least privilege (no endpoint returns data from another org); CC7.2 audit of every call. Notes: decided 2026-10-24; Q1 (b) when wxKanban creates the group, (a) when YappChatt does; Q2 (b) retired rooms hidden; Q3 (c) welcome email plus the wxKanban route; Q4 owner/admin/member; Q5 boundary as listed. |
