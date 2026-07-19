# SCOPE-090: Chat Groupings Foundation

**Scope Number**: 090
**Status**: `draft`
**Created**: 2026-07-18
**Last Reviewed**: 2026-07-18
**Depends On**: SPEC-001 (Common Chat Engine — `conversations` / `conversationmembers`, the per-user room row this extends), SPEC-018 (Contacts & DMs — the chat list rendered in `ChatsNav`), SPEC-068 (App shell — the sidebar this grouping UI lives in), SPEC-011 (auth — `ctx.user.id` ownership)
**Source**: `specs/Project-Scope/090-chat-groupings-foundation.md`

## Overview

Give each user a way to **organize their own chat rooms into named groupings** ("folders") under the CHAT area of the sidebar. A user can **create a grouping** (e.g. "Work", "Family", "PROJECTS"), then **add, move, or remove** their chatrooms under it. Groupings are **strictly personal and view-only**: they change only how *that user's* sidebar is organized — never a room's membership, access, or what any other member sees.

Each grouping carries a **`type`** (`general` or `projects`). In this scope `type` is stored and displayed but has **no behavioral effect** — it is the forward hook that the separate **Project Systems** scope (SPEC-091) keys off to bind `projects`-type rooms to an AI remote-management agent. This scope ships *only* the organizational container; no agent, no binding, no translation behavior.

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | Signed-in YappChat user organizing their own chat list into personal groupings. |
| **Secondary Actors** | The chat sidebar (`ChatsNav`, spec 068/018) that renders the groupings; the Common Chat Engine (spec 001) `conversationmembers` row that anchors per-user room state; SPEC-091 (Project Systems) as the downstream consumer of `type = 'projects'`. |
| **Key Value** | Users with many rooms can file them into meaningful folders they control, and the app gains the `projects`-type grouping primitive that remote AI project management (091) is built on — without any access-control or cross-member coordination risk. |

## Business Problem

A user's chat list today is a single flat list rendered in `ChatsNav.tsx`, ordered by most-recent activity (`listMyChats` → sort by `lastmessageat`). There is no favorite, pin, folder, category, or label concept anywhere — as room counts grow the list becomes unmanageable, and there is no way for a user to say "these rooms belong together." Separately, the planned Project Systems feature (SPEC-091) needs a first-class, per-user container that declares "these rooms are development projects" so an AI agent can be bound to them; there is currently no such primitive. This scope solves the immediate organization need and lays the exact foundation 091 requires, as a small, low-risk, independently useful piece.

## Actors

- Primary: Signed-in user — creates groupings and files their own rooms into them; sees only their own groupings.
- Secondary: Chat sidebar (`ChatsNav`) — renders the user's groupings as collapsible folders above the ungrouped flat list.
- Secondary: Common Chat Engine (spec 001) — owns `conversationmembers`, the per-user, per-room row this scope extends with `groupingid` / `position`.
- Secondary: Project Systems (SPEC-091) — downstream consumer that reads `chatgroupings.type = 'projects'` to attach agent/binding behavior (out of scope here).

## Scope Boundary

**IN (v1):** A per-user `chatgroupings` table (`name`, `type` = `general | projects`, `position`); a nullable `groupingid` + `position` on `conversationmembers` so each user files each of their rooms under one of their own groupings; CRUD routes for groupings; an assign/move/remove route for a room's grouping; sidebar UI in `ChatsNav` rendering collapsible grouping folders above the existing flat list, a "New grouping" action (name + type), and a per-room "Move to grouping" menu; per-browser persisted folder open/closed state (consistent with the existing sidebar accordion). Deleting a grouping nulls `groupingid` on affected rooms (rooms fall back to ungrouped). Migration `0028_chat_groupings.sql` (hand-authored — the drizzle journal is desynced past 0019).

**OUT (v1):** Any behavioral effect of `type = 'projects'` (agent binding, remote management, status feed, translation — all SPEC-091); drag-and-drop reordering (a menu is enough for v1); grouping community **spaces** (this scope covers the `ChatsNav` DM/group list only — spaces render separately in `AppSidebar` via `/api/nav`); shared/team groupings visible to other members; nested groupings; grouping-driven access control of any kind.

## Out of Scope

Anything that changes who can access a room; any AI, agent, project-binding, or translation behavior (SPEC-091); syncing groupings across users; grouping the Communities→Spaces tree; server-side persistence of folder expand/collapse state.

## User Scenarios & Testing

### US1 — Create a grouping and file rooms into it (happy path)

**Actor**: Signed-in user

**Scenario**:
1. In the sidebar CHAT area the user clicks **New grouping**, names it "PROJECTS", picks type **Projects**.
2. The empty "PROJECTS" folder appears above the flat chat list.
3. On an existing room the user opens **Move to grouping ▸** and picks "PROJECTS".
4. The room moves under the PROJECTS folder; it no longer appears in the ungrouped list.
5. The user collapses the folder; the state persists on reload (per-browser).

**Expected outcome**: The grouping and the room's placement persist server-side (grouping row keyed to the user; `conversationmembers.groupingid` set). No other member of that room sees any change; the room's membership and access are untouched.

### US2 — Move and remove

**Actor**: Signed-in user

**Scenario**: The user moves a room from "PROJECTS" to "Work", then chooses **Remove from grouping** on another room.

**Expected outcome**: `groupingid` updates to the new grouping, or to `null` (room returns to the ungrouped flat list). No room data changes.

### US3 — Delete a grouping

**Actor**: Signed-in user

**Scenario**: The user deletes the "Work" grouping while two rooms are filed under it.

**Expected outcome**: The grouping row is deleted; both rooms' `groupingid` is set to `null` and they reappear in the ungrouped flat list. No room, membership, or message is ever destroyed.

### US4 — Isolation / edge conditions

**Actor**: Two users who share a room

**Scenario**: User A files a shared room under their "PROJECTS" grouping. User B opens the same room. A second grouping op targets a room the user is not a member of, or a grouping the user does not own.

**Expected outcome**: User B sees the room exactly as before (in their own list/ordering) — A's grouping is invisible to B. Any op on a grouping the caller doesn't own, or a room the caller isn't a member of, is rejected (403/404). `type` has no behavioral effect anywhere in this scope.

## Functional Requirements

### Groupings
- **FR-001** — A user can **create** a grouping with a `name` and a `type` (`general` | `projects`); the grouping is owned by and visible to only that user.
- **FR-002** — A user can **rename**, **reorder** (via `position`), and **change the type** of their own groupings, and **delete** a grouping.
- **FR-003** — Grouping **names are unique per user** (`(userid, name)`); a user may have any number of groupings.

### Room placement
- **FR-004** — A user can **assign** one of their rooms to one of their groupings, **move** it between groupings, and **remove** it (back to ungrouped) — by setting `conversationmembers.groupingid` for **their own** membership row only.
- **FR-005** — A room is filed under **at most one** grouping per user (`groupingid` is a single nullable FK); `null` = ungrouped and renders in the flat list as today.
- **FR-006** — Placement is **per-user**: it never modifies the room, its membership, its access, or any other member's view.

### Deletion safety
- **FR-007** — Deleting a grouping sets `groupingid = null` on every affected `conversationmembers` row (`on delete set null`); **no room, membership, or message is deleted**.

### Type hook (inert here)
- **FR-008** — `type` is **stored and surfaced in the UI** but has **no behavioral effect** in this scope; all `projects`-type behavior is owned by SPEC-091, which reads `type = 'projects'`.

### Sidebar UI
- **FR-009** — `ChatsNav` renders the user's groupings as **collapsible folders above the ungrouped flat list**; users with no groupings see today's flat list unchanged.
- **FR-010** — The UI provides **New grouping** (name + type) and a per-room **Move to grouping ▸** menu (grouping list + "Remove from grouping").
- **FR-011** — Folder **open/closed state persists per-browser** in `localStorage`, consistent with the existing `AppSidebar` accordion.

### Authorization
- **FR-012** — Every grouping and placement operation is scoped to `ctx.user.id`; a caller may only act on **their own groupings** and **their own membership rows** — cross-user access is rejected.

## Data Requirements

- **chatgroupings** — `id` (uuid v7 PK), `userid` (uuid, owner; FK-less to `users.id` per engine-schema convention), `name` (text), `type` (text, default `'general'`, allowed `general | projects`), `position` (int, default 0), `createdat` (timestamptz). Unique index on `(userid, name)`; index on `userid`.
- **conversationmembers** (existing, spec 001) — add `groupingid` (uuid, nullable, FK → `chatgroupings.id` `on delete set null`) and `position` (int, nullable — order within the grouping). No change to existing columns; both new columns default null so pre-existing rows render exactly as today.
- Reuses spec 001 `conversations` / `conversationmembers` and spec 011 `users`. Runs in the `yappchat` Postgres schema.

## API Routes

- `GET  /api/chat-groupings` — list the caller's groupings (`id`, `name`, `type`, `position`).
- `POST /api/chat-groupings` — create `{ name, type }`.
- `PATCH /api/chat-groupings/:id` — rename / reorder / change `type` (own grouping only).
- `DELETE /api/chat-groupings/:id` — delete; nulls `groupingid` on affected rooms.
- `PATCH /api/chats/:conversationid/grouping` — set the caller's placement for that room: `{ groupingid | null, position }` (own membership row only).
- All obtain identity via `engineContext()` (`ctx.user.id`), matching the existing `/api/chats` handlers.

## Frontend Components

- **Grouping folders in `ChatsNav`** — collapsible sections above the ungrouped flat list, each showing its rooms; type shown as a small label/badge.
- **New grouping control** — a "+ New grouping" affordance capturing `name` + `type` (`General` / `Projects`).
- **Move-to-grouping menu** — a per-room menu ("Move to grouping ▸" + "Remove from grouping").
- Reuses the existing `ChatsNav` polling/refresh (`/api/chats`, `nav:refresh`) and `localStorage` accordion-state pattern from `AppSidebar`.

## Success Criteria

1. A user can create, rename, reorder, and delete groupings; names are unique per user. — *FR-001, FR-002, FR-003*
2. A user can file, move, and remove their own rooms into/out of groupings; a room is under at most one grouping per user. — *FR-004, FR-005*
3. No grouping operation ever changes a room's membership, access, or another member's view of it. — *FR-006*
4. Deleting a grouping returns its rooms to ungrouped with zero data loss. — *FR-007*
5. Users with no groupings see the existing flat chat list unchanged. — *FR-009*
6. `type` is stored and displayed but has no behavioral effect in this scope. — *FR-008*
7. All operations are rejected when they target another user's grouping or a room the caller isn't a member of. — *FR-012*

## Key Entities

- **Chat grouping** — a user-owned, named, typed folder for organizing that user's chat rooms in the sidebar.
- **Room placement** — the per-user assignment of a room (via `conversationmembers.groupingid`) to one of that user's groupings.
- **Grouping type** — `general` or `projects`; a declaration that (in SPEC-091) makes a grouping's rooms AI-remote-managed. Inert in this scope.

## Constraints

- Groupings are **view-layer only** — they must never affect room membership, access, or other members' views (the agreed safe pattern).
- Per-user state lives on `conversationmembers` (the established anchor for per-user, per-room state like `lastreadat` / `autotranslate`); groupings are keyed by `userid`.
- Covers the `ChatsNav` DM/group chat list only; Communities→Spaces grouping is out of scope for v1.
- Runs over the `yappchat` Postgres schema, Drizzle, Next.js 16 App Router route handlers (no tRPC); migrations generated/hand-authored only, applied manually (drizzle journal desynced past 0019 → `0028` hand-authored).

## Notes

- This scope is the **container** SPEC-091 (Project Systems) depends on. It deliberately ships the `type` field inert so 091 can attach agent binding, the status feed, and auto-translation to `projects`-type groupings without re-plumbing the data model.
- Drag-and-drop reordering, spaces grouping, and shared/team groupings are explicitly deferred (YAGNI for v1).

## Open Questions

- **Position semantics**: is `chatgroupings.position` user-editable in v1 (explicit reorder UI) or just creation-order? (Lean: store it now, expose reorder later.)
- **Type immutability**: once SPEC-091 binds an agent to a `projects` grouping, should changing `type` back to `general` be blocked? (Deferred to 091 — this scope allows free type changes.)

## Architecture Decisions (2026-07-18)

1. **Groupings are per-user and view-only** — keyed by `userid`, placement stored on the user's own `conversationmembers` row; never touches room membership or access. Rejected: shared/team groupings (require cross-member coordination and risk access surprises).
2. **`type` shipped inert as a forward hook** — the foundation stores `general | projects` now so SPEC-091 keys off it with no data-model change. Rejected: waiting to add `type` until 091 (would force a second migration and re-plumb).
3. **Foundation and Project Systems are separate scopes** — this scope is small, low-risk, and independently useful; the large agent/binding/security surface lives entirely in SPEC-091.
4. **Menu-based placement, not drag-and-drop, for v1** — smallest viable interaction; DnD deferred.

## Delta — Implemented 2026-07-18

Built end-to-end (schema + migration + service + routes + sidebar UI). `tsc --noEmit` clean, eslint clean, full suite green — **154 tests pass** (10 new grouping validation tests). **Migration 0028 generated, NOT yet applied** (manual apply per convention; drizzle journal desynced past 0019 → hand-authored).

- **Schema/migration** — new `chatgroupings` table (`lib/db/groupings-schema.ts`; per-user, `type` default `general`, unique `(userid,name)`); `groupingid` + `position` added to `conversationmembers` (`engine-schema.ts`); registered in `db/client.ts`. Hand-authored `drizzle/0028_chat_groupings.sql` (idempotent guards, `--> statement-breakpoint`, FK `ON DELETE SET NULL`).
- **Service** — `lib/groupings/service.ts` (`listGroupings`, `createGrouping`, `updateGrouping`, `deleteGrouping`, `setRoomGrouping`) with `requireOwnGrouping` enforcing per-user ownership (404), placement requiring room membership (404), and duplicate-name → 409. Pure input validators in `lib/groupings/validation.ts` (name trim/bound, `general|projects` allow-list, position).
- **API** — `GET|POST /api/chat-groupings`, `PATCH|DELETE /api/chat-groupings/:id`, `PATCH /api/chats/:conversationid/grouping`. `listMyChats` now returns each room's `groupingid`.
- **UI** — `ChatsNav.tsx`: collapsible grouping folders above the ungrouped flat list (unchanged when no groupings), inline New-grouping form (name + General/Projects), per-room "Move to grouping" menu + "Remove from grouping", grouping delete, `projects` badge, per-browser folder open/closed state in `localStorage`.
- **Inert `type`** — stored + shown (the `proj` badge) but with zero behavioral effect; SPEC-091 is the sole consumer.
- **Deferred/manual:** apply migration 0028; DB-integration tests for isolation/deletion-safety (no DB test harness in-repo — enforced by `requireOwnGrouping` + the `ON DELETE SET NULL` FK; validation logic unit-tested).

### Extension — Create rooms under a grouping (2026-07-18)

Added the ability to **create a new room directly under a grouping** (not just move existing ones). Migration 0028 already applied; no further schema change. `tsc`/eslint clean, 154 tests pass.

- **Members chosen each time; empty = a solo room** — solo rooms are the ones bound to Claude for remote management (SPEC-091). A solo room must have a name; a multi-member room may be untitled.
- **Project rooms open with their own room id as the first message** — created under a `type = 'projects'` grouping, the room's opening system message is its `conversationid`, giving the caller/agent the handle to connect for remote management.
- **Service** — `createRoom(creator, memberIds, { title })` in `contacts/service.ts` generalizes `createGroupChat` to allow 0 members + a title (accepted-contact validation unchanged, atomic). `createRoomInGrouping(creator, { title, memberIds, groupingid })` in `groupings/service.ts` verifies grouping ownership, creates the room, files it (reusing `setRoomGrouping`), and posts the room-id first message for `projects` groupings.
- **API** — `POST /api/chats` now also accepts `{ groupingid, title?, memberIds? }`; with `groupingid` it routes to `createRoomInGrouping` (solo allowed), else unchanged group-chat behavior.
- **UI** — each folder has a `+` → inline create-room form (name + optional contact toggles; empty = solo). Projects folders label it "New project room." Creating navigates to the new room.
- **Boundary unchanged** — 090 creates the room; **binding it to the Claude agent for remote management remains SPEC-091**.
