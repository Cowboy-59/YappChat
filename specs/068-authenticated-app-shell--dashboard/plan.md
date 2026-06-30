# Plan: Authenticated App Shell + Dashboard

**Spec Number**: 068
**Date**: 2026-06-23 (reconstructed 2026-06-30)

## Implementation Plan

### Phase 1: Account data + session (T001–T002)

- Add nullable `bio`, `avatarurl`, `preferredlanguage` to the spec-011 `users` table via a generate-only Drizzle migration (0010), applied manually (safe ADD COLUMN on a populated table).
- Widen the `SessionUser` type and the `getSessionUser` select so `/api/auth/me` exposes the new fields (no change to existing auth flows).
- Add `src/lib/account/service.ts#updateProfile` plus supporting `languages.ts`, `avatars.ts`, and `avatar-resolve.ts`.
- Add `PATCH /api/account/profile` (zod-validated; preset-only avatarurl) and `POST /api/account/avatar` (multipart → private S3 → presigned preview).

### Phase 2: Membership availability (T003)

- Add `setAvailability(communityid, userid, patch)` to the spec-017 communities service and `PATCH /api/communities/[id]/members/me` (requireMembership; 200 member / 404 non-member).
- Extend `listMyCommunities` to return `availabilitystatus` + `availabilitynote` to seed the dashboard control.

### Phase 3: Shell + dashboard (T004–T005)

- Create `src/app/(authenticated)/layout.tsx` (server, force-dynamic) guarding auth once and rendering sidebar + realtime + email-verify chrome; move the six route folders beneath the group with URLs unchanged.
- Build `src/components/shell/` navigation and `src/app/(authenticated)/app/page.tsx` dashboard with `DiscoverWidget`, `ProfilePanel` (avatar picker + language select), and `AvailabilityControl` client islands.

### Phase 4: Return-url + verification (T006–T007)

- Extend `src/lib/auth/return-url.ts` to permit /communities, /messaging, /assistant, /studio; add tests.
- Verify: `tsc --noEmit`, `eslint`, `vitest`, and a live e2e against a running server.

## Known Issues

- **Shell restructured after the original build (2026-06-27).** The flat sidebar from T004 was superseded by a far-left IconRail + accordion AppSidebar (Communities + Chats trees with unread badges, Presentations link), with CommunitiesApp/MessagingApp made URL-driven. FR-002 reflects the restructured form, which is what ships today.
- **Live e2e not re-run post-restructure.** Static verification is green as of 2026-06-30 (`tsc --noEmit`, `eslint`, `vitest` 111/111). The live e2e last passed 2026-06-23 (8/8), before the restructure; a fresh live run (running server + sysadmin session cookie) is the only outstanding verification item. No dedicated 068 e2e script exists yet.
- **Migration 0010 applied.** `0010_confused_jetstream.sql` adds the three `users` columns; 0000–0010 are live in the `yappchat` schema. Manual-apply path per the project's migration rule.
- **Lifecycle stage still Design.** Orchestrator stage has not transitioned Design → Implementation, so task status is tracked in `tasks.md` rather than synced to the wxKanban DB.
- **Docs reconstructed 2026-06-30.** This plan.md and the spec.md were degraded to template boilerplate by an earlier regeneration and were rebuilt from the tasks breakdown and the shipped implementation.
