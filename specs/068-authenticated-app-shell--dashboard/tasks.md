# Task Breakdown: Authenticated App Shell + Dashboard

**Feature**: Authenticated App Shell + Dashboard
**Spec**: 068
**Date Generated**: 2026-06-23
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Tasks

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Account profile schema + session widening | high | done |
| 2 | Profile read/update endpoint + service | high | done |
| 3 | Per-community availability setter | high | done |
| 4 | Authenticated route-group shell + sidebar | high | done |
| 5 | Dashboard home + client islands | high | done |
| 6 | Return-url allow-list extension + tests | medium | done |
| 7 | Verification | medium | done (static) |

**Verification (2026-06-30, post 06-27 shell restructure):** `tsc --noEmit` clean, `eslint` clean, `vitest` **111/111 passing**. Implementation re-confirmed file-by-file against T001–T006 (schema cols + migration 0010; updateProfile + PATCH /api/account/profile + POST /api/account/avatar S3 upload + languages/avatars/avatar-resolve; setAvailability + PATCH /api/communities/[id]/members/me; (authenticated)/layout.tsx + AppSidebar; 4-section dashboard + ProfilePanel avatar picker/language select + DiscoverWidget + AvailabilityControl; return-url allow-list + tests). Live e2e against a running server was last passed 2026-06-23 (8/8) pre-restructure; a fresh live e2e is the only outstanding item.

## Task Details

### T001 — Account profile schema + session widening

Add three nullable columns to the spec-011 `users` table — bio, avatarurl, preferredlanguage — via a generate-only Drizzle migration (applied manually; safe ADD COLUMN on a populated table). Widen the SessionUser type and the getSessionUser select/return to carry the new fields so /api/auth/me exposes them. No behavior change to existing auth flows.

### T002 — Profile read/update endpoint + service

Add updateProfile(userid, patch) in a new account service and a PATCH /api/account/profile route gated by requireAuth, zod-validating displayname (1-80), preferredlanguage (one of the five supported ISO codes en/fr/es/de/pt — see src/lib/account/languages.ts — nullable), avatarurl (null or a preset path from src/lib/account/avatars.ts; PATCH rejects arbitrary URLs/keys), bio (<=2000, nullable); 200 on valid, 422 on invalid. Keep /api/auth/me read-only.

Avatar IMAGE uploads are a separate action: POST /api/account/avatar (multipart `file`, requireAuth, image-only png/jpeg/gif/webp, <=5MB) stores the image to private S3 under `avatars/{userid}/{uuid}.{ext}`, persists the key on users.avatarurl, and returns a presigned preview URL. Reads resolve the stored value via resolveAvatarUrl (src/lib/account/avatar-resolve.ts): preset/public paths pass through, S3 keys are presigned.

### T003 — Per-community availability setter

Add setAvailability(communityid, userid, patch) in the spec-017 communities service and a PATCH /api/communities/[id]/members/me route gated by requireMembership (any member sets their own); zod-validate availabilitystatus (<=32, nullable) and availabilitynote (<=280, nullable); 200 for a member, 404 for a non-member. Extend listMyCommunities to also return availabilitystatus + availabilitynote to seed the dashboard control.

### T004 — Authenticated route-group shell + sidebar

Create src/app/(authenticated)/layout.tsx (server, force-dynamic) that guards auth once and renders AppSidebar + AppRealtime + EmailVerifyNotice around a main content column. Create src/components/shell/AppSidebar.tsx (client) with usePathname active-route highlight, nav items (Home, Communities, Messaging, Assistant, Studio, Admin[isSystemStaff-only]) using next/link, and a user menu (name/email + ThemeToggle + SignOutButton). Move the app, communities, messaging, assistant, studio, and admin folders under (authenticated)/ with URLs unchanged; keep per-page auth guards and admin's own isSystemStaff gate.

### T005 — Dashboard home + client islands

Rewrite src/app/(authenticated)/app/page.tsx into a four-section dashboard (server component using getSessionUser + getActiveOrg + listMyCommunities): My communities (rows with role badge, link into /communities, and an AvailabilityControl), Discover (DiscoverWidget client), Module quick links, and Profile (ProfilePanel client). Add components/dashboard/{DiscoverWidget,ProfilePanel,AvailabilityControl}.tsx. Prefer small client islands over a big client wrapper to keep the page server-rendered. In ProfilePanel the Preferred language field is a dropdown (`<select>`) limited to the five supported languages from src/lib/account/languages.ts plus a "Not set" (null) option — not free text. The Avatar field is a picker (preview + Upload image + a row of preset thumbnails + Remove), not a URL text box: uploads POST to /api/account/avatar, presets/clear PATCH /api/account/profile, and each avatar change persists immediately and refreshes. The resolved avatar (via resolveAvatarUrl) also renders in the AppSidebar user block, falling back to the display-name initial.

### T006 — Return-url allow-list extension + tests

Extend the regexes in src/lib/auth/return-url.ts to also permit /communities, /messaging, /assistant, /studio (today only /app* and /admin*), so logged-out deep links to those routes return correctly post-login. Add matching cases to src/lib/auth/return-url.test.ts.

### T007 — Verification

Verify end-to-end: tsc --noEmit, eslint, vitest (incl. new return-url cases), and a live e2e script (sysadmin yc_session cookie) covering GET /api/auth/me new fields, PATCH /api/account/profile valid+invalid (200/422), PATCH /api/communities/[id]/members/me (200 member / 404 non-member) reflected in the member directory, and a manual route smoke test that all six authenticated routes keep their URLs and render under the shell.
