# Spec 013: Admin Console

**Spec Number**: 013
**Status**: `design`
**Created**: 2026-06-18
**Scope Source**: [`specs/Project-Scope/013-admin-console.md`](../Project-Scope/013-admin-console.md) — full requirements, data model, API routes, and success criteria (18 FRs, 4 scenarios, 10 success criteria)
**Depends On**: Spec 011 (auth roles, `requireAuth`/`requireAdmin`, `authauditlog`, `devicesessions`, force-revoke, `system-roles`, `oauthproviderconfigs`), Spec 012 (`landingpageconfig`), Spec 002 (`aiproviders`, `postPANotification`), Spec 003 (WebSocket live updates + health source), Spec 004 (skills disable/enable), Spec 008 (`mobiledevices`), Spec 006 / 009 (health surfacing only)

## Overview

The Admin Console is the role-aware control plane at `/admin` — the single authenticated surface where YappChat staff operate the deployment. Specs 011, 003, 002, 008, and 012 each exposed primitives (force-sign-out, role grants, capacity alerts, system-default AI provider, device sessions, landing config) but deliberately deferred the UI to drive them to here. Without spec 013, all of those are DB-only operations.

Spec 013 is strictly a consumer/orchestrator — it calls existing endpoints owned by other specs rather than reimplementing their logic. Its own net-new domain is small: a feedback/suggestions inbox (`feedbackitems` + `feedbacknotes`) and a health-probe result cache (`healthprobes`). Everything else is reads and proxied actions over tables and routes other specs already ship.

Access is server-side gated: any user with no system flag set is rejected before the page renders (not merely hidden in the UI), and no admin markup or data is shipped to a non-staff client. The data layer is role-aware on three tiers: system admin (`issystemadmin`, cross-org), support (`issupport`, cross-org read-only), and org owner/admin (own-org scope only — narrower, opt-in per deployment). A Switch-to-user-view control drops the admin into `/app` without dropping their session.

The spine is the access gate + tiered authorization + append-only audit (FR-001/002/018) — get those wrong and every other surface leaks data. A single `requireAdmin()` guard reads a shared capability map (`action -> required flag`) that the UI and API both consume, so a disabled control always matches a rejecting endpoint.

## Business Problem

Across specs 011/012/002/008/003 the team built the *mechanisms* of deployment operation — force-sign-out, system-role grants, landing-page config, system-default AI provider, capacity/health alerts — but never a UI to operate them. Today a YappChat operator must run raw SQL or hand-call internal endpoints to revoke a stolen-device session, promote a support engineer, or switch a failing AI provider. That is slow, error-prone, unauditable in practice, and a non-starter for SOC 2. The Admin Console makes every one of those operations a gated, audited, role-appropriate action behind `/admin`, and gives staff a single place to triage user feedback and watch deployment health.

## Actors

- Primary: System administrator (`issystemadmin`) — operates the entire deployment; full cross-org read + all mutations.
- Secondary: Support staff (`issupport`) — cross-org read-only triage (feedback, audit, users, health); the only write permitted is appending internal feedback notes.
- Secondary: Billing admin (`isbillingadmin`) — lands in `/admin` but has no surfaces here in v1 (billing is spec 014).
- Secondary: Org owner/admin — own-org-scoped subset (feedback, stats, audit, users) when org-admin access is enabled for the deployment; v1 ships staff-first.

## Success Metrics

1. **Gate is server-side, 100%** — non-staff receive zero admin markup/data for `/admin` and every `/api/admin/*` route, verified in the raw response (not post-hydration).
2. **Tier isolation** — `issupport` and org-admin callers never receive another org's data; support mutation attempts are rejected at the API on 100% of write endpoints.
3. **Force-sign-out round-trip ≤ 2s** — click → session revoked + `auth.force_signout` over WS + row flips to "Revoked" without reload, with an immediate attributed `authauditlog` row.
4. **Audit completeness 100%** — every state-changing admin action writes an attributed append-only `authauditlog` row.
5. **Health is fast + fresh** — dashboard renders cached results < 500ms with no synchronous probing; any check staler than 2× its interval shows `unknown`, never green.

(Full 10-criterion list in the scope document.)

## Scope Boundary

**IN:** `/admin` mount + server-side system-flag gate; three-tier role-aware data layer + shared capability map; feedback + suggestions inbox with triage; system-wide stats dashboard; health dashboard + singleton probe runner; audit-log viewer; `SystemRoleManager`; `LandingPageConfigPanel`; cross-spec tooling — force-sign-out across orgs, disable/enable a skill, configure system-default AI provider, configure OAuth/OIDC credentials; user directory + device-session viewer; "Switch to user view". New code lives in `apps/web/src/app/admin/*` + `apps/web/src/components/admin/*` and new API routes under `apps/web/src/app/api/admin/*`. New tables: `feedbackitems`, `feedbacknotes`, `healthprobes`.

**OUT:** Stripe/billing management UI (spec 014); reimplementing any toggled feature's logic; org member-management UI (spec 011 `OrgMembershipManager`, in `/app`); BI/analytics beyond basic stats; multi-deployment fleet management; the email/WS/job services themselves (013 only surfaces health); impersonate/"view-as user"; CSV export of feedback/audit.

## Out of Scope

Deferred to future work: FR-016 (MCP pause/resume) until spec 002's MCP registry (T008) ships; FR-017 (org-admin scoped console) access is opt-in, off by default in v1; CSV export and impersonation; materialized-view stats (only if query-time proves slow).

## Open Questions

None blocking. Resolved during the 2026-06-18 scope session (see scope doc Clarifications): feedback+suggestions share one table; stats = query-time + cache; health = scheduled probe → cache; prober is a WS-engine singleton; support read-only except notes; denied access audited; OAuth/OIDC config reuses 011's `oauthproviderconfigs`.

## Functional Requirements

> Acceptance criteria below are condensed; the authoritative per-FR criteria are in [`specs/Project-Scope/013-admin-console.md`](../Project-Scope/013-admin-console.md).

### FR-001 — `/admin` mount + server-side access gate
The `/admin` surface and all `/api/admin/*` routes MUST be gated server-side to users holding ≥1 system flag; non-staff get a redirect (`/app`) or 403 with no admin data in the payload; all routes use the single shared `requireAdmin({ flag?, minTier? })` guard.

### FR-002 — Three-tier role-aware authorization
Reads/writes are scoped by tier: `issystemadmin` cross-org; `issupport` cross-org read-only; org owner/admin own-org. A single capability map (`action → required flag`) is the source both UI and API read.

### FR-003 — Admin shell, navigation & "Switch to user view"
Tier-aware nav (no dead links); a Switch-to-user-view control to `/app` without dropping the session; shell shows the caller's identity + active flags.

### FR-004 — Feedback & suggestions inbox
Single `feedbackitems` table with `kind ∈ {feedback, suggestion}`; inbox filterable by kind/status/org/submitter; sysadmin + support cross-org, org admin own-org.

### FR-005 — Feedback lifecycle & triage
Status `new → triaged → in_progress → resolved → wont_fix` (transitions sysadmin-only); support read-only on status but may append `feedbacknotes`; assignment + every change attributed and audited.

### FR-006 — System-wide stats dashboard
Deployment-wide counters (users, orgs by plan, active sessions, messages 24h/7d, skill invocations + error rate, PA sessions, push deliveries) via query-time aggregation + short-TTL cache (default 60s); org admins see own-org scope.

### FR-007 — Health dashboard
Surfaces WS engine (003), PA monitoring loops (002), push fanout worker (009), async job runners (006), email deliverability (011) with status/last-probe/latency/last-error; reads cached results only; stale (> 2× interval) renders `unknown`.

### FR-008 — Health probe scheduler
A singleton runner in the WS-engine process upserts `healthprobes` per-check (default 60s; email 5-min); failures emit a deduped `pa.notification` to all `issystemadmin` via 002 `postPANotification`; one failing probe never blocks others.

### FR-009 — Audit-log viewer
Read-only, filterable view of 011 `authauditlog` (eventtype/actor/target/org/date), paginated, tier-scoped.

### FR-010 — System role management (`SystemRoleManager`)
`issystemadmin`-only toggle of the three system flags via 011 `PATCH /api/auth/system-roles/:userid`; lists flagged users; each grant/revoke writes `role_grant`; no-self-lockout guardrail.

### FR-011 — User directory, device sessions & force-sign-out
Searchable directory (tier-scoped); per-user device-session viewer joining 011 `devicesessions` + 008 `mobiledevices`; force-sign-out (per-device or all) proxies 011 force-revoke with live WS update; support cannot force-sign-out.

### FR-012 — Landing page config (`LandingPageConfigPanel`)
`issystemadmin` editor for every jsonb section of 012 `landingpageconfig` with live preview; save validates via 012 Zod schema (422 on malformed), bumps `updatedat`, triggers cache bust, writes audit.

### FR-013 — System-default AI provider configuration
`issystemadmin` views 002 `aiproviders` and sets the single system-default (partial-unique); Test-connection calls the 002 ping; API keys never returned to client.

### FR-014 — OAuth / OIDC provider configuration
`issystemadmin` enables/configures Google/Apple/Microsoft/GitHub + generic OIDC by reusing 011 `oauthproviderconfigs` + `PATCH /api/auth/oauth/providers/:providerkey`; secrets stored write-only as `clientsecretref`; incomplete credentials rejected.

### FR-015 — Disable / enable a skill (cross-org)
`issystemadmin` disables/enables any 004 skill deployment-wide via 004's endpoints (effect ≤ 60s, audited); deep-linked from health/stats for high-error skills.

### FR-016 — Pause / resume an MCP server (deferred)
Stated but **deferred** until spec 002's MCP registry (T008) ships.

### FR-017 — Org owner/admin own-org view (opt-in)
When enabled, an org owner/admin sees own-org feedback/stats/audit/users only; the tiered data layer (FR-002) already supports this; v1 staff-first.

### FR-018 — Audit coverage for admin actions & denials
Every state-changing admin action writes an attributed `authauditlog` row; denied `/admin` access attempts are recorded (lightweight); audit rows are append-only.

### FR-019 — Global invite console (system admin)
A system administrator (`issystemadmin`) operates a cross-org invite console at `/admin` that aggregates **both** of YappChat's invite systems into one management surface: company/org member invites (spec 011 `orginvitations`) and community/space invite links (spec 017 `communityinvites`, incl. FR-021 reusable links). Consumer/orchestrator per FR-002 — it reads and **proxies** the 011/017 services, never reimplementing them.

- **List** — a unified, filterable table of **live** invites across the whole deployment: **type** (`company` | `community` | `space`), **target** (company name, or community + space), **created by**, **uses** (email-bound single-use for company; `usecount / maxuses / remaining` for community), **expires**. Filter by type; search by target. Support (`issupport`) sees it **read-only**; org owner/admin do not (their tools stay at `/members` + the community Manage panel).
- **Create** — mint an invite into **any** company (proxies 011 `inviteOrgMember`) or **any** community/space (proxies 017 `createInvite`/`createSpaceInvite`, incl. FR-021 `maxuses`), via a type-discriminated form.
- **Revoke** — kill any live invite: proxies 011 org-invite revoke + 017 `revokeInvite`. Support cannot revoke.
- **Gate + audit** — system-admin gated on every mutation; each create/revoke writes an attributed `authauditlog` row (the underlying 011/017 audit rows still fire). Denied access recorded per FR-018.
- **Routes** — `GET /api/admin/invites` (aggregated list, `?type=`/`?q=`), `POST /api/admin/invites` (create, body discriminated by `type`), `POST /api/admin/invites/:source/:id/revoke` (`source ∈ {org, community}`).
- **v1 boundary** — live invites only (spent/revoked history deferred); redeemer drill-down (`communityinviteredemptions`) deferred to a follow-up.

## Data Model (new tables)

- **`feedbackitems`** — `id` (v7 PK), `kind` (feedback|suggestion), `status` (new|triaged|in_progress|resolved|wont_fix, default new), `orgid` (FK orgs), `submittedby` (FK users), `body`, `context` jsonb, `assignedto` (FK users, nullable), `createdat`, `updatedat`. Indexes: `(status)`, `(orgid)`, `(kind)`.
- **`feedbacknotes`** — `id` (v7 PK), `feedbackid` (FK feedbackitems, cascade), `authorid` (FK users), `body`, `createdat`.
- **`healthprobes`** — `checkkey` (text PK), `status` (healthy|degraded|failing|unknown), `latencyms`, `lasterror`, `probedat`, `intervalseconds`. Upsert per check.

All other data needs are reads/acts over existing tables (`users`, `orgmemberships`, `orgs`, `sessions`, `devicesessions`, `mobiledevices`, `authauditlog`, `oauthproviderconfigs`, `landingpageconfig`, `aiproviders`, `skills`). Migrations are **generated only** (manual apply per project rule).

**FR-019** adds **no new tables** — it reads/acts over `orginvitations` (011) + `communityinvites` (017), joined to `orgs`/`communities`/`spaces`/`users` for display names, and attributes actions in `authauditlog`.

## Tasks

See [tasks.md](tasks.md) — 8 tasks (T001–T008), ordered security-spine-first.

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-06-18
- **Phase**: design

## Delta — Implemented 2026-07-12 (Global invite console, FR-019)

Spec-first (FR-019 + the [proposed delta](./PROPOSED-DELTA-global-invite-console.md) written and approved before code). A self-contained slice of the Admin Console — it does not depend on the rest of 013 being built, only on the existing `getSessionUser`/`isSystemStaff` gate. Aggregates both invite systems (company + community/space) into one system-admin surface.

- **Backend** (`lib/admin/invites.ts`) — `listAllInvites({type?, q?})` (union of live `orginvitations` + `communityinvites`, joined for names); `adminCreateInvite(input, actor)` (proxies 011 `inviteOrgMember` for `company`, 017 `createInvite`/`createSpaceInvite` for `community`/`space`); `adminRevokeInvite(source, id, actor)` (proxies 011 org-revoke + 017 `revokeInvite`); `listInviteTargets()` (corporate orgs + communities/spaces for the create form). Each mutation writes an attributed `authauditlog` row (`admin_invite_created` / `admin_invite_revoked`).
- **Routes** — `GET /api/admin/invites` (list, `?type=`/`?q=`, staff read), `POST /api/admin/invites` (create, sysadmin), `POST /api/admin/invites/:source/:id/revoke` (sysadmin), `GET /api/admin/invites/targets`. Gated inline (`issystemadmin` for writes, `isSystemStaff` for reads).
- **UI** — `InviteConsole` (`components/admin/InviteConsole.tsx`) on `/admin` for system admins: filterable list + type-discriminated create form (reusing FR-021 reusable-link options) + per-row Revoke.
- **v1 boundary** — live invites only; redeemer drill-down deferred.
