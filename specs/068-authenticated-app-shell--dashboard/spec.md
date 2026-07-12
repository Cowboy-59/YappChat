# Spec 068: Authenticated App Shell + Dashboard

## Overview

After sign-in, YappChat web users land on /app — a placeholder card — and there is no shared navigation across the authenticated routes (app, communities, messaging, assistant, studio, admin). Each route is a standalone page, so moving between product areas means hand-editing the URL, and Communities (the flagship) is not even linked.

This feature introduces a persistent authenticated app shell and a real dashboard home. A Next route group `(authenticated)/layout.tsx` wraps every authenticated route (URLs unchanged), guards auth once, and renders a left sidebar plus realtime + email-verify chrome around the page content. /app is rewritten into a dashboard surfacing four areas: the user's communities (each with an inline per-community availability control), discovery/search of public communities, quick links to the product modules, and an editable account profile.

To support the profile and availability surfaces, the account `users` table gains three nullable columns (bio, avatarurl, preferredlanguage) via a manual Drizzle migration, a `PATCH /api/account/profile` endpoint edits them, and a `PATCH /api/communities/[id]/members/me` endpoint lets a member set their own per-community availability. The post-login return-url allow-list is extended so deep links to /communities, /messaging, /assistant, and /studio return correctly after sign-in. The feature reuses spec 011 (auth/session) and spec 017 (communities) services and existing shared components; it does not reimplement community internals.

## Business Problem

A signed-in user has no home and no map. The post-login destination (/app) is a static placeholder, and every product area (communities, messaging, assistant, studio, admin) is an island reachable only by typing its URL — the flagship Communities surface isn't even linked. There is also nowhere to manage one's own account profile or set per-community availability. The desired outcome is a single persistent shell that guards auth once, navigates everywhere, and a dashboard home that orients the user (their communities, discovery, module shortcuts, profile) the moment they sign in. This is prioritized now because it is the connective tissue every other authenticated feature depends on, and it gates the imminent first deployment of the web app.

## Actors

- Primary: Authenticated YappChat web user who lands on the shell after sign-in, navigates across all product areas from one sidebar, edits their account profile, and sets their own per-community availability.
- Secondary: System staff (sysadmin) who additionally sees the Admin entry in the shell, plus the spec-011 auth/session and spec-017 communities services that this shell consumes rather than reimplements.

## Success Metrics

1. 100% of authenticated routes (app, communities, messaging, assistant, studio, admin — 6/6) render inside the shared shell with their URLs unchanged, verified by a route smoke test.
2. Auth is guarded exactly once per navigation at the route-group layout (0 duplicated shell-level redirects), and 100% of allow-listed deep links (/app, /communities, /messaging, /assistant, /studio, /admin) return the user to the originally requested URL after login.
3. Server-side validation holds on every write: `PATCH /api/account/profile` returns 422 on 100% of the invalid-field matrix and 200 on valid input, and `PATCH /api/communities/[id]/members/me` returns 404 for non-members (0 cross-member writes).

## Scope Boundary

This scope covers the authenticated shell and dashboard surfaces only:

- `src/app/(authenticated)/layout.tsx` (route-group shell, single auth guard, chrome) and the six route folders moved beneath it with URLs unchanged.
- `src/components/shell/` sidebar/navigation (AppSidebar, IconRail) and shell chrome (realtime, email-verify notice, user menu, theme toggle, sign-out).
- `src/app/(authenticated)/app/page.tsx` dashboard home and `src/components/dashboard/{DiscoverWidget,ProfilePanel,AvailabilityControl}.tsx` client islands.
- Account profile: `users.{bio,avatarurl,preferredlanguage}` columns (migration 0010), `src/lib/account/{service,languages,avatars,avatar-resolve}.ts`, `PATCH /api/account/profile`, `POST /api/account/avatar` (S3 upload).
- Per-community availability: communities-service `setAvailability` + `listMyCommunities` extension, `PATCH /api/communities/[id]/members/me`.
- `src/lib/auth/return-url.ts` allow-list extension (+ tests).

## Out of Scope

This iteration does NOT change: community internals (browse/join/spaces/moderation — owned by spec 017), messaging internals (spec 001), assistant/studio internals (specs 002/004), the admin console itself (spec 013 — only its nav entry is added here), and the WebSocket engine (spec 003). Also out of scope: pgvector-backed search, organization-level admin views, billing, and the Electron/desktop shell. Avatar storage uses the existing S3 bucket; no new infrastructure is provisioned.

## Open Questions

None at this time. All design questions were resolved during implementation; see the Status note for the post-restructure state.

## Functional Requirements

### FR-001 — Authenticated route-group shell

A Next route group `(authenticated)/layout.tsx` (server, force-dynamic) MUST wrap every authenticated route, guard auth exactly once, and render the navigation sidebar plus realtime and email-verify chrome around the page content. The six route folders (app, communities, messaging, assistant, studio, admin) live beneath the group with their public URLs unchanged; per-page guards and admin's own system-staff gate are preserved.

**Acceptance Criteria**:

- [ ] All six authenticated routes render inside the shell with unchanged URLs.
- [ ] An unauthenticated request to any shell route is redirected to login by the layout (no per-page divergence in the shell path).

### FR-002 — Left navigation sidebar + user menu

The shell MUST present persistent navigation: a far-left IconRail (Home/Assistant/Studio/Admin + avatar) and an accordion AppSidebar with Communities and Chats trees (each leaf carrying an unread badge) plus a Presentations link. The Admin entry is shown only to system staff. A user menu exposes the display name/email, theme toggle, and sign-out; the resolved avatar (via resolveAvatarUrl) renders in the user block, falling back to the display-name initial.

**Acceptance Criteria**:

- [ ] Active route is highlighted; navigation uses client-side links (no full reloads).
- [ ] Admin nav appears for system staff only; avatar resolves or falls back to the initial.

### FR-003 — Dashboard home at /app

`/app` MUST be a dashboard (server-rendered, using getSessionUser + getActiveOrg + listMyCommunities) presenting: a welcome/org header, quick links to the product modules, the editable account Profile panel, a public-community Discover widget, and the user's communities each with an inline availability control.

**Acceptance Criteria**:

- [ ] A signed-in user sees their communities, discovery, module links, and profile on /app.
- [ ] The page is server-rendered with small client islands rather than one client wrapper.

### FR-004 — Account profile schema + session exposure

The spec-011 `users` table MUST gain three nullable columns — bio, avatarurl, preferredlanguage — via a generate-only Drizzle migration applied manually. The SessionUser type and getSessionUser select carry the new fields so `/api/auth/me` exposes them, with no behavior change to existing auth flows.

**Acceptance Criteria**:

- [ ] Migration 0010 adds the three columns to yappchat.users (safe ADD COLUMN).
- [ ] `GET /api/auth/me` returns bio, avatarurl, preferredlanguage.

**Translation setting (added 2026-07-12):** a follow-on generate-only Drizzle migration MUST add an `autotranslate boolean NOT NULL default false` column to `yappchat.users` — the global "Always show messages in my language" switch (target language = `preferredlanguage`). SessionUser + getSessionUser carry it so `/api/auth/me` exposes it. This is the account-level default consumed by spec 017 FR-012 and spec 018 FR-018-TR-*; a per-room override lives on `conversationmembers.autotranslate` (spec 001 shared core), not here.

- [ ] The follow-on migration adds `autotranslate` (safe ADD COLUMN, default false); `GET /api/auth/me` returns it.

### FR-005 — Profile read/update endpoint

`PATCH /api/account/profile` (requireAuth) MUST update the profile via an account-service `updateProfile`, zod-validating displayname (1–80), bio (≤2000, nullable), preferredlanguage (one of en/fr/es/de/it/pt, nullable), avatarurl (null or a preset path only — arbitrary URLs/keys rejected), and `autotranslate` (boolean — the global "always show messages in my language" default). Returns 200 on valid input and 422 on invalid. `/api/auth/me` stays read-only.

**Acceptance Criteria**:

- [ ] Valid patches return 200 and persist; invalid fields return 422.
- [ ] avatarurl accepts only null or a known preset path through this endpoint.

### FR-006 — Avatar upload + picker

Avatar image uploads MUST be a distinct action: `POST /api/account/avatar` (requireAuth, multipart `file`, image-only png/jpeg/gif/webp, ≤5MB) stores the image to private S3 under `avatars/{userid}/{uuid}.{ext}`, persists the key on users.avatarurl, and returns a presigned preview URL. The ProfilePanel renders an avatar picker (preview + Upload image + preset thumbnails + Remove), not a URL text box; presets/clear go through `PATCH /api/account/profile`. Reads resolve the stored value via `resolveAvatarUrl` (presets pass through; S3 keys are presigned).

**Acceptance Criteria**:

- [ ] Upload of a valid image ≤5MB returns a presigned preview and persists the S3 key; oversized/non-image is rejected.
- [ ] Selecting a preset or removing the avatar persists immediately and re-renders in the panel and sidebar.

### FR-007 — Per-community availability

Communities-service `setAvailability(communityid, userid, patch)` and `PATCH /api/communities/[id]/members/me` (requireMembership — any member sets their own) MUST let a member set availabilitystatus (≤32, nullable) and availabilitynote (≤280, nullable): 200 for a member, 404 for a non-member. `listMyCommunities` is extended to also return availabilitystatus + availabilitynote to seed the dashboard control.

**Acceptance Criteria**:

- [ ] A member's availability write returns 200 and is reflected in listMyCommunities and the member directory.
- [ ] A non-member write returns 404 (no cross-member writes).

### FR-008 — Post-login return-url allow-list extension

The return-url allow-list in `src/lib/auth/return-url.ts` MUST also permit /communities, /messaging, /assistant, and /studio (previously only `/app*` and `/admin*`), so logged-out deep links to those routes return correctly after login. Lookalike paths are rejected and the admin path remains system-staff gated.

**Acceptance Criteria**:

- [ ] Deep links to the four added user routes survive the login round-trip.
- [ ] Lookalike/forged return targets are rejected; return-url tests cover the new cases.

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-06-30
- **Phase**: design (lifecycle not yet transitioned to implementation)
- **Implementation**: T001–T006 built in `apps/web`; migration 0010 applied. Shell later restructured (2026-06-27) to the IconRail + accordion AppSidebar form described in FR-002, superseding the original flat sidebar.
- **Verification (T007)**: static checks green 2026-06-30 — `tsc --noEmit`, `eslint`, and `vitest` (111/111). Live e2e last passed 2026-06-23 (8/8), before the 06-27 restructure; a fresh live e2e is the only outstanding item.
- **Note**: this spec.md and plan.md were degraded to template boilerplate by an earlier regeneration and were reconstructed on 2026-06-30 from the tasks breakdown and the shipped implementation.

## Delta — Implemented 2026-07-12 (Surface company invite on the dashboard)

Spec-first (see [proposed delta](./PROPOSED-DELTA-surface-company-invite.md)). Purely a discoverability change over an already-shipped spec 011 capability — **no new invite logic**.

- **Invite a colleague** — the dashboard home (`/app`) shows a quick-action card when the caller's **active org is corporate** and their **role is owner/admin** (same gate as `/members`). Routes to `/members` (single canonical org-invite surface). Reuses spec 011; no backend change.
- **Invite users to a space** (added 2026-07-12 per user feedback) — an **"Invite to a space"** control on `/app` for any user who **owns/moderates a community** (holds `invite:create`). Pick a community + space (or Whole community) + uses, and generate a shareable FR-021 link — the intended flow is e.g. wxKanban inviting users into its **Public** or **Support** chat without opening the community Manage panel. Backed by `listMyInviteTargets(userid)` (owner/moderator communities + spaces, reusable eligibility) passed server-side into `DashboardSpaceInvite`; posts to the existing 017 FR-021 endpoints (`POST /api/communities/:id[/spaces/:spaceid]/invites`). Admin/corp-only spaces stay single-use.
