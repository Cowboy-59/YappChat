# Spec 011: Authentication & Authorization

**Spec Number**: 011
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 001 (userid joins to userencryptionkeys), Spec 002 (FR-017 PA notification SDK, FR-016 OAuth library reuse), Spec 003 (WS auth + event publish), Spec 008 (SecureKeyStore.clearUser, AuthGate component), Spec 010 (pairing prerequisite)
**Source**: `specs/Project-Scope/011-auth.md`

---

## Overview

Authentication & Authorization is the identity backbone every other YappChat scope assumes exists. Specs 001–010 reference "the caller is authenticated", "admin routes are admin-only", and "this user's session", but no scope owns the actual sign-up, login, session, role, or org-membership data model. Spec 011 fills that hole.

The scope covers the full lifecycle: email-and-password signup with argon2id hashing, magic-link/OTP as a passwordless alternative, OAuth/OIDC login with configurable providers (Google, Apple, Microsoft, GitHub built-in plus generic OIDC for self-hosted SSO), opaque session tokens with refresh-token rotation and reuse detection, password reset by emailed one-time link, three-role per-org RBAC (owner / admin / member), three independent system-level flags on the user (`issystemadmin`, `isbillingadmin`, `issupport`), org creation and membership, the `AuthGate` component spec 008 already references, the `useAuth` hook every UI surface consumes, logout that calls `SecureKeyStore.clearUser` for clean key isolation, a device session registry distinct from but linked to spec 008's `mobiledevices` and spec 009's `pushtokens`, admin-triggered forced sign-out propagated over WebSocket, and AI agent API token issuance per spec 001 FR-010.

Spec 011 is also the prerequisite for spec 010's pairing flow (a new device must be authenticated *before* it can begin pairing) and for the spec 003 capacity-alert recipient (the admin user identified by an admin role, not a hard-coded email).

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat user — signs up, logs in, manages their devices |
| **Secondary Actors** | YappChat administrator (sets system defaults, manages org membership, triggers forced sign-out); AI coding agent (long-lived API token holder per spec 001 FR-010); other scopes 001-010 (consume identity / role information through `useAuth` and server-side session middleware) |
| **Key Value** | The single source of truth for "who is the caller" and "what are they allowed to do" — closes the dependency gap that has been blocking every other spec |
| **Scope Boundary** | IN SCOPE: email+password signup (argon2id); magic-link / email-OTP login; OAuth/OIDC login with built-in providers (Google, Apple, Microsoft, GitHub) plus generic OIDC for self-hosted SSO; opaque session tokens; refresh token rotation with reuse detection; password reset flow; three-role per-org RBAC; three independent system flags (`issystemadmin`, `isbillingadmin`, `issupport`); first-system-admin bootstrap from `BOOTSTRAP_ADMIN_EMAIL` env on deployment first-run; system-admin grant/revoke API restricted to existing system admins; org creation & membership; AuthGate; useAuth + AuthContext; logout flow that calls SecureKeyStore.clearUser; device session registry; admin force-sign-out propagated over WebSocket; AI agent API token issuance and revocation; pairing prerequisite for spec 010. OUT OF SCOPE: SAML and Google Workspace domain federation (different protocol family); biometric unlock (spec 008); MFA/TOTP — follow-on; user impersonation tooling; GDPR right-to-erasure / account deletion compliance flows. |

---

## Two-tier RBAC Model

| Layer | Roles | Scope |
| --- | --- | --- |
| **System-level** (`users.issystemadmin`, `users.isbillingadmin`, `users.issupport` booleans) | Independent flags — any combination allowed | Across the entire YappChat deployment |
| **Org-level** (`orgmemberships.role` enum) | `owner` · `admin` · `member` | Within a single org membership |

**The two layers are orthogonal**: most users have no system flags set + `member` of their personal org. YappChat staff have `issystemadmin=true` and may have no org memberships. A user can hold both simultaneously.

**Retargeted admin references across other specs**:

| Spec touchpoint | Which admin type |
| --- | --- |
| Spec 003 FR-007 capacity alert recipient | System admin |
| Spec 004 custom skill templates / agent template management | Org admin |
| Spec 006 custom doc templates | Org admin |
| Spec 006 generation log access | System admin |
| Spec 007 company avatar | Org admin |
| Spec 007 system default avatar | System admin |
| Spec 002 setup-guide content authoring | System admin |
| Spec 002 `aiproviders.isdefault` | System admin |
| Force-sign-out a user in your org | Org admin |
| Force-sign-out across orgs / system-wide bans | System admin |
| Spec 013 Admin Console — role-aware dashboard | Both (scope-aware) |

---

## User Scenarios & Testing

### US1 — First-time user signs up with email + password

**Actor**: New visitor

**Scenario**:

1. User clicks **Sign up** on spec 012 landing page → spec 011 signup form.
2. They enter email + password (zxcvbn ≥ 3 enforced client-side). Server hashes with argon2id (m_cost 64MB / t_cost 3).
3. Server creates `users` row, default `orgs` row (auto-created personal org), `orgmemberships` row (role: owner), initial `sessions` and `refreshtokens` rows. Sends an `emailverificationtokens` link.
4. Response sets the session cookie (httpOnly, sameSite=lax, secure) and a refresh-token cookie (httpOnly, longer-lived). UI navigates to the YappChat app with an unverified-email banner.
5. Client-side `useAuth` reflects the authenticated state. Spec 008 `AuthGate` (mobile) treats this as a fresh user and walks them through spec 001 E2E key generation + spec 010 backup setup.

**Expected outcome**: Signup → first authenticated screen ≤ 10s p95.

### US2 — Returning user logs in with magic link (no password)

**Actor**: Returning user, no password manager

**Scenario**:

1. User clicks **Email me a link** on the login form, types their email.
2. Server creates a `magiclinktokens` row (single-use, 10-min TTL, hashed token), emails the link.
3. User opens the email, clicks. Server validates and consumes the token, issues session + refresh tokens, redirects to app.
4. The token is marked `consumedat` — replays return HTTP 410.

**Expected outcome**: Email arrives within 30s. Click-to-app under 3s.

### US3 — Refresh-token reuse detection invalidates the entire session family

**Actor**: Honest user with a stolen refresh token (attacker scenario)

**Scenario**:

1. User's session is alive. Client refreshes via `POST /api/auth/refresh` with the current refresh token. Server rotates it, returns a new refresh token, marks the old one `replacedbyid: <new>`.
2. An attacker who previously stole the OLD refresh token tries to use it.
3. Server detects: an already-replaced token is being presented again. It revokes the **entire session family** (every refresh token chained from the same `familyid`) and revokes all session tokens linked to those refresh tokens.
4. Both the attacker AND the legitimate user are logged out. Legitimate user receives a `pa.notification` via spec 002 FR-017 SDK (`bypassQuietHours: true`): "We logged you out everywhere because we detected a reused login token. Sign back in."

**Expected outcome**: Reuse detected and family revoked within 1 second. PA notification arrives within 5s.

### US4 — Logout clears local keys via `SecureKeyStore.clearUser`

**Actor**: Mobile user signing out

**Scenario**:

1. User taps **Sign out** in settings.
2. Client calls `POST /api/auth/logout`. Server revokes the current session, the refresh-token family, and emits an `auth.signed_out` WSEvent so other tabs/devices for the same user see the logout.
3. Client calls `SecureKeyStore.clearUser(userid)` (spec 008 FR-004) — purges all of that user's E2E keys and any cached credentials from the device.
4. Client transitions to spec 008 `AuthGate` → login screen.

**Expected outcome**: Server-side revoke + client-side key clear within 500ms p95. Other user-tabs sign out within 2s of the WSEvent.

### US5 — Admin force-signs-out a compromised device

**Actor**: YappChat administrator (org admin if user is in their org, OR system admin)

**Scenario**:

1. A user reports their phone was stolen. Admin opens spec 013 admin console, filters to that user, sees their device sessions list.
2. Admin clicks **Force sign-out** on the stolen-device row.
3. Server: revokes the matching `sessions` row, marks the `devicesessions` row `revokedat`, emits `auth.force_signout` WSEvent scoped `user:{userid}` with `deviceid` payload.
4. The targeted device receives the event over WebSocket within 2s, AuthGate immediately drops to the login screen, and `SecureKeyStore.clearUser(userid)` runs locally.
5. Other devices for the same user are unaffected.

**Expected outcome**: Force sign-out propagates within 2s. Other devices' sessions remain valid.

### US6 — AI coding agent uses an API token to post into its YappChat channel

**Actor**: Claude Code / Cursor / a custom LLM agent (per spec 001 FR-010)

**Scenario**:

1. Admin registers a new agent in the spec 001 admin UI. Spec 011's API issues a long-lived `agentapitokens` row with a fresh secret (shown once, hashed in storage).
2. Agent sends `POST /api/engine/agents/:id/messages` with `Authorization: Bearer <apitoken>`. Spec 011's middleware authenticates the token, looks up the corresponding `users` row (with `kind: "agent"`), and attaches it to the request.
3. Spec 001's existing FR-010 logic accepts the request as if it came from the agent's userid.
4. Admin later revokes the token via `DELETE /api/auth/agents/:agentid/tokens/:tokenid`. The next call returns HTTP 401.

**Expected outcome**: Token issuance and revocation each complete in under 1s. Revoked tokens are rejected by the next request — no caching delay.

### US7 — System admin reviews a cross-org incident

**Actor**: YappChat staff member (`issystemadmin=true`)

**Scenario**:

1. A user from Org X submits feedback through spec 013's feedback inbox: "Our skill `get_jira_sprint` is failing constantly — looks like a wider issue."
2. System admin opens spec 013 Admin Console and sees deployment-wide health: skill error rates across all orgs, recent feedback tickets, system stats.
3. System admin filters skill error rates by `skillname`, sees the same skill failing in 4 other orgs (cross-org visibility — only system admins get this).
4. System admin checks the underlying handler health (community skill from spec 002 FR-006; handler URL is dead).
5. System admin posts a deployment-wide notification via spec 002 FR-017 SDK targeting all users with that skill installed: "Community skill `get_jira_sprint` is currently broken — the handler endpoint is offline."
6. Org admins of the affected orgs see the same incident in their org-scoped view (no cross-org skill data, but they see THEIR org's instance of the failure).

**Expected outcome**: System admin's cross-org view loads in ≤ 2s. Org admins see only their own org's slice with no leakage of other orgs' data. The deployment-wide notification reaches every affected user within 60s via spec 009 push fanout.

---

## Functional Requirements

### FR-001 — Email + password signup

The system MUST allow new users to sign up with email + password, hashing passwords with argon2id, and sending email verification.

**Acceptance Criteria**:

- [ ] `POST /api/auth/signup` accepts `{ email, password, displayname, plan, orgname? }` where `plan: 'individual' | 'corporate'` is required and `orgname` is required when `plan === 'corporate'` (ignored otherwise — spec 012 plan-aware signup routing per spec 012 FR-006). Password strength is validated client-side with zxcvbn (score ≥ 3) and server-side as a length floor (≥ 8). The server NEVER stores the plaintext password.
- [ ] Password hashed with argon2id, parameters: m_cost 64MB (`m_cost: 65536` KiB), t_cost 3, parallelism 1. Same parameters as spec 010 FR-002.
- [ ] On success: creates `users` row (with `users.plan` set from the request), an `orgs` row (spec 001) — name from `orgname` for corporate plan OR auto-generated `"{displayname}'s Workspace"` for individual plan, the user becomes `owner` via `orgmemberships`, an initial `sessions` row, a `refreshtokens` row (familyid = id), and an `emailverificationtokens` row (24h TTL).
- [ ] For corporate plan: `orgs.seatlimit` is set null (unlimited, scaled by billing) and `orgs.plantype = 'corporate'`. For individual plan: `orgs.seatlimit = 1` (prevents accidental team onboarding into an individual plan) and `orgs.plantype = 'individual'`.
- [ ] Missing `plan` parameter returns HTTP 400 `{ error: "plan_required" }`. Missing `orgname` when `plan === 'corporate'` returns HTTP 400 `{ error: "orgname_required_for_corporate" }`.
- [ ] Sends a verification email with a link to `/api/auth/email-verify/:token`. Verification is required before high-trust actions (e.g., publishing community skills, accepting org invitations beyond the user's auto-org) but does not block sign-in.
- [ ] Email uniqueness enforced — duplicate email returns HTTP 422 with a generic body (no account enumeration via timing or message).
- [ ] Signup → first authenticated screen ≤ 10s p95 (measured by synthetic E2E).
- [ ] Bot-defence: a server-side soft rate limit of 10 signups per IP per hour. Exceeding returns HTTP 429.

### FR-002 — Email + password login

The system MUST allow returning users to log in with their email + password, with rate limiting to deter brute force.

**Acceptance Criteria**:

- [ ] `POST /api/auth/login` accepts `{ email, password }`. Returns HTTP 200 with session cookie + refresh-token cookie set, plus `{ user, org }` in the body.
- [ ] Verifies password by re-hashing input with the stored salt+parameters and comparing in constant time.
- [ ] Rate limit: 5 wrong attempts per (IP + email) per 15 minutes → HTTP 429 with `retry-after` header. Successful login resets the counter.
- [ ] Wrong email and wrong password return the SAME error code and SAME response timing (account enumeration protection).
- [ ] Successful login writes a row to `authauditlog` with `eventtype: 'login'` and the anonymised IP.

### FR-003 — Magic-link / email-OTP login

The system MUST support passwordless login via emailed magic link.

**Acceptance Criteria**:

- [ ] `POST /api/auth/login/magic/request` accepts `{ email }`. Always returns HTTP 202 (no account enumeration).
- [ ] If the email belongs to a user, a `magiclinktokens` row is created (10-minute TTL, single-use, `tokenhash` stored). The plaintext token is the URL segment in the emailed link.
- [ ] `GET /api/auth/login/magic/:token` validates and consumes the token (marks `consumedat`), issues session + refresh tokens, redirects to the app.
- [ ] Replayed tokens return HTTP 410. Expired tokens return HTTP 410. Lookups are by SHA-256 hash of the token; the plaintext token never leaves the email body.
- [ ] Magic link works for both existing users AND first-time sign-up (if no `users` row matches the email, a new account is created on consume — frictionless onboarding).

### FR-004 — Session token issuance and validation

The system MUST issue and validate opaque session tokens with sub-millisecond lookup performance.

**Acceptance Criteria**:

- [ ] Session token: 32 random bytes from `crypto.randomBytes`, base64-URL encoded. Stored hashed (SHA-256) in `sessions.sessiontokenhash`. The plaintext token is the cookie value.
- [ ] Cookie attributes: `httpOnly; Secure; SameSite=Lax; Path=/`. Domain configurable per deployment.
- [ ] Session has 24-hour sliding expiry — `lastusedat` updated on each validated request; `expiresat` recomputed lazily when within 1h of expiry to avoid write amplification.
- [ ] Validation: one indexed lookup on `sessions(sessiontokenhash)`. Returns the user + org context in ≤ 5ms p95.
- [ ] Spec 003 WebSocket connect-time validation calls this same path; total WS auth must be ≤ 100ms p95.
- [ ] Session revocation: setting `revokedat` immediately invalidates future requests (no token-revocation cache).

### FR-005 — Refresh token rotation with reuse detection

Every refresh request rotates the token. Detecting reuse of a rotated token revokes the entire session family.

**Acceptance Criteria**:

- [ ] Refresh token: 32 random bytes, base64-URL encoded, stored hashed. Cookie attributes match session cookie + longer TTL (30 days).
- [ ] `POST /api/auth/refresh` validates the presented refresh token by hash, generates a NEW refresh token, issues a new session, and sets `refreshtokens.replacedbyid = <newid>` on the old row. The old refresh token is now invalid.
- [ ] Grace window: for 5 seconds after rotation, the immediately-previous token is also accepted (returns the same new tokens). This handles network retry races without false-positive family revoke.
- [ ] Reuse detection: if a request presents a refresh token whose `replacedbyid IS NOT NULL` AND the grace window has expired, the server REVOKES the entire `familyid` (every `refreshtokens` row + every `sessions` row linked to those refresh tokens), then writes an `authauditlog` row with `eventtype: 'family_revoke'`.
- [ ] On family revoke, server publishes `auth.signed_out` WSEvent scoped `user:{userid}` AND calls spec 002 FR-017 `postPANotification` with `bypassQuietHours: true`, `callerscope: 'auth-family-revoke'`, previewtext "We logged you out everywhere because we detected a reused login token. Sign back in."
- [ ] Family revoke completes in ≤ 1s (single DB statement over the family).

### FR-006 — Password reset via emailed link

Users MUST be able to reset their password via a one-time emailed link, invalidating all existing sessions on successful reset.

**Acceptance Criteria**:

- [ ] `POST /api/auth/password-reset/request` body `{ email }`. Always returns HTTP 202 (no account enumeration). Email message body: "If an account exists for that email, we sent a reset link."
- [ ] If the email matches, a `passwordresettokens` row is created (15-minute TTL, single-use, hashed).
- [ ] `POST /api/auth/password-reset/consume` body `{ token, newpassword }` validates and consumes the token, re-hashes the new password with argon2id, updates `users.passwordhash`, AND revokes ALL existing sessions + refresh-token families for that user.
- [ ] Password strength validation identical to FR-001.
- [ ] Audit: `authauditlog` row with `eventtype: 'password_reset'`.
- [ ] Round-trip (request → email → consume → new session) ≤ 60s including a real email send.

### FR-007 — Logout with SecureKeyStore.clearUser

Logout MUST revoke the current session server-side AND clear local keys client-side.

**Acceptance Criteria**:

- [ ] `POST /api/auth/logout` revokes the calling session (sets `revokedat`), revokes the linked refresh-token family, publishes `auth.signed_out` WSEvent scoped `user:{userid}`, writes `authauditlog` row.
- [ ] Server-side revoke + WSEvent emit complete in ≤ 500ms p95.
- [ ] Client-side: on successful logout response, the client calls `SecureKeyStore.clearUser(userid)` (spec 008 FR-004) to purge all of that user's E2E keys from the device.
- [ ] Other tabs / devices for the same user receive the `auth.signed_out` WSEvent and trigger their own client-side logout within 2s.
- [ ] Logout cookie clearing: server sets `Set-Cookie: session=; Max-Age=0; ...` and the same for the refresh cookie.

### FR-008 — Per-org three-role RBAC

The system MUST enforce role-based access at the org level with three roles.

**Acceptance Criteria**:

- [ ] `orgmemberships.role` enum: `owner` | `admin` | `member`. UNIQUE constraint on `(userid, orgid)`.
- [ ] Owners can promote/demote any member, transfer ownership, delete the org. Admins can invite members, change member-to-admin roles, but NOT touch other admins or owners. Members have no management permissions.
- [ ] Sole-owner protection: demoting the last `owner` of an org returns HTTP 422 `{ error: "last_owner_protection" }`. Same protection on `DELETE` of the last-owner membership row.
- [ ] All org-scoped resource queries (skills, sessions, aiproviders, panotifications, pushtokens, oauthidentities, agentapitokens, messages) MUST include an `orgid` filter sourced from the caller's `orgmemberships`. The middleware injects this; bespoke per-query implementations are a hard violation.

### FR-009 — System-level role flags + bootstrap

The system MUST support three independent system-level capability flags plus a first-launch bootstrap path.

**Acceptance Criteria**:

- [ ] `users.issystemadmin`, `users.isbillingadmin`, `users.issupport` booleans, default `false`. Independently grantable.
- [ ] `PATCH /api/auth/system-roles/:userid` body `{ issystemadmin?, isbillingadmin?, issupport? }` — restricted to callers with `issystemadmin=true`. Writes an `authauditlog` row with `eventtype: 'role_grant'`.
- [ ] `GET /api/auth/system-roles` returns the list of users with any system flag set. Visible to `issystemadmin` and `issupport`.
- [ ] **Bootstrap**: on server startup, if `BOOTSTRAP_ADMIN_EMAIL` env is set AND `SELECT count(*) FROM users WHERE issystemadmin=true` is 0, the boot sequence either creates a new `users` row OR updates the existing matching-email row to set `issystemadmin=true` AND `isbillingadmin=true`. Audit row written with `eventtype: 'role_grant'`, `payload: { reason: 'bootstrap' }`.
- [ ] Bootstrap is idempotent: subsequent runs with a system admin already present are a no-op.
- [ ] On bootstrap, the granted user receives BOTH a PA channel notification (via spec 002 FR-017 SDK) AND an email — covers the cold-start case where the PA channel isn't yet configured.

### FR-010 — Org creation and membership management

The system MUST allow users to create orgs and invite others, with email-based invitations.

**Acceptance Criteria**:

- [ ] `POST /api/orgs` body `{ name, avatarurl?, location? }` creates an `orgs` row (spec 001 schema) and an `orgmemberships` row for the caller with `role: 'owner'`.
- [ ] `POST /api/orgs/:orgid/invitations` body `{ email, role }` (owner/admin only) creates an `orginvitations` row (7-day TTL, hashed token, role pre-set) and emails an accept link.
- [ ] `POST /api/orgs/invitations/:token/accept` consumes the invitation and creates the `orgmemberships` row with the pre-set role. If the email is not yet a `users` row, the recipient must sign up first; the invitation is bound to the email, not a userid.
- [ ] `PATCH /api/orgs/:orgid/memberships/:userid` body `{ role }` (owner/admin only, respecting hierarchy from FR-008).
- [ ] `DELETE /api/orgs/:orgid/memberships/:userid` removes the membership. Cascades clean up org-scoped resources owned by that user IN that org (skills, sessions, providers, etc., per the resource's ownership model).
- [ ] `GET /api/orgs/:orgid/memberships` lists members; visible to any member of the org.

### FR-011 — AuthGate component contract

The `AuthGate` component (referenced by spec 008 FR-012) MUST be the root of every client surface and gate access to the app based on authentication state.

**Acceptance Criteria**:

- [ ] `AuthGate` mounts above the app, fetches `GET /api/auth/me` on mount.
- [ ] If unauthenticated → renders `LoginScreen`. If authenticated → renders children with `AuthContext` populated.
- [ ] Subscribes to `auth.signed_out` and `auth.force_signout` WSEvents scoped `user:{currentuserid}`. On receipt with matching device, triggers logout flow (FR-007).
- [ ] Cold render ≤ 200ms p95 (single `/me` round trip).
- [ ] Spec 008 mobile shell mounts this as root per spec 008 FR-012.
- [ ] During the initial fetch, `AuthGate` shows a brand-aware skeleton (avoids flash of unauthenticated content for already-authenticated users).

### FR-012 — useAuth hook and AuthContext

A single shared `useAuth` hook MUST be the source of truth for client-side auth state.

**Acceptance Criteria**:

- [ ] `AuthContext` shape: `{ user, org, hasRole(roleName: 'owner'|'admin'|'member'): boolean, hasSystemFlag(flag: 'issystemadmin'|'isbillingadmin'|'issupport'): boolean, signIn(method, payload), signOut(), refresh() }`.
- [ ] `hasRole(name)` checks the caller's role in their active org.
- [ ] `hasSystemFlag(flag)` checks the corresponding boolean on the user row.
- [ ] Reactive: when the underlying auth state changes (login, logout, role grant via WSEvent), all consumers re-render.
- [ ] Implementation: React Context. No per-component auth fetches — everything reads from the provider.

### FR-013 — Admin force-sign-out

Org admins MUST be able to force-sign-out users within their org. System admins MUST be able to force-sign-out any user.

**Acceptance Criteria**:

- [ ] `POST /api/auth/sessions/:id/force-revoke` revokes the targeted session. Authorization: org-admin caller AND target session's user is a member of caller's org, OR system-admin caller.
- [ ] On force-revoke, server emits `auth.force_signout` WSEvent scoped `user:{targetuserid}` with payload `{ sessionid, deviceid, by: callerid, reason? }`.
- [ ] Propagation to the target device ≤ 2s p95 (via spec 003 WS delivery).
- [ ] The target device receives the event, AuthGate immediately drops to LoginScreen, `SecureKeyStore.clearUser(userid)` runs locally.
- [ ] Other devices for the same user are UNAFFECTED.
- [ ] Audit: `authauditlog` with `eventtype: 'force_signout'`, full payload including `by` (caller).

### FR-014 — Device session registry

The system MUST maintain a per-device session registry linked to spec 008 `mobiledevices`, spec 009 `pushtokens`, spec 001 `userencryptionkeys`, and spec 010 `keypairings` via a shared `deviceid`.

**Acceptance Criteria**:

- [ ] `devicesessions` table (added by this spec) joins `userid` ↔ `deviceid` ↔ `sessions.id`.
- [ ] The `deviceid` value matches across `mobiledevices.deviceid` (spec 008), `pushtokens.deviceid` (spec 009), `userencryptionkeys.deviceid` (spec 001), and `keypairings.deviceid` (spec 010 — the new device's id).
- [ ] `GET /api/auth/sessions` returns the caller's active sessions: `{ id, deviceid, device summary (model/useragent), ipaddress (anonymised), createdat, lastusedat }`.
- [ ] Multi-tenant fuzz test verifies a single deviceid joins across all 4 spec scopes correctly.

### FR-015 — AI agent API token issuance and revocation

Long-lived API tokens for AI agents (per spec 001 FR-010) MUST be issued and revoked through spec 011's auth surface.

**Acceptance Criteria**:

- [ ] `POST /api/auth/agents/:agentid/tokens` body `{ name, expiresat? }` issues a new token. Returns the plaintext token ONCE in the response body. `tokenhash` is stored in `agentapitokens`. Authorization: caller must be the agent's registrar OR an org admin / system admin.
- [ ] `agents` (spec 001) joins to `users` via `userid` where `users.kind = 'agent'`. The agent's authentication is via `Authorization: Bearer <apitoken>` — middleware resolves to that `users` row.
- [ ] `DELETE /api/auth/agents/:agentid/tokens/:tokenid` sets `revokedat`. The NEXT request with that token is rejected — no caching.
- [ ] `GET /api/auth/agents/:agentid/tokens` lists tokens with last 6 chars of token shown, `name`, `createdat`, `expiresat`, `revokedat`.
- [ ] Issuance and revocation each ≤ 1s.

### FR-016 — Spec 010 pairing prerequisite

The spec 010 device-pairing flow MUST require an authenticated session.

**Acceptance Criteria**:

- [ ] `POST /api/keybackup/pairing/start` (spec 010 FR-005) returns HTTP 401 if the caller is unauthenticated.
- [ ] The `pairing:{pairingid}` WS scope subscription (spec 003 FR-002, scope auth rules) checks `keypairings.userid = currentuserid` AND requires a valid session.
- [ ] The pairing nonce in the QR code is signed with the server's auth secret so the existing device verifies the QR was issued by this server (prevents pairing-QR spoofing).

### FR-017 — OAuth/OIDC login

The system MUST support OAuth/OIDC login with configurable providers — Google, Apple, Microsoft, GitHub built-in, plus generic OIDC for self-hosted SSO.

**Acceptance Criteria**:

- [ ] Built-in providers seeded as `oauthproviderconfigs` rows on first launch with `enabled=false`, `clientid`/`clientsecretref` blank. System admin sets credentials to enable.
- [ ] `GET /api/auth/oauth/providers` returns the list of enabled providers (no secrets).
- [ ] `GET /api/auth/oauth/:provider/start` initiates auth-code + PKCE flow: generates `state` (random 32 bytes, set as httpOnly cookie), generates PKCE `code_verifier` + `code_challenge`, redirects to the provider's auth URL.
- [ ] `GET /api/auth/oauth/callback/:provider` receives `?code&state` from the provider: validates `state` cookie, exchanges code + `code_verifier` for tokens, fetches the user profile (email, sub, name, picture).
- [ ] On first OAuth login (no matching `oauthidentities` row): creates `users` row with `passwordhash=NULL`, `emailverifiedat=now()` IF provider asserts `email_verified=true`, ELSE requires verification. Creates personal org + ownership row.
- [ ] On subsequent OAuth login: resolves to existing `users` row via `oauthidentities(providerkey, subjectid)`, issues session.
- [ ] **No auto-link by email match** (SOC 2): if the provider's email matches an existing email-password account, returns HTTP 409 with message "An account already exists for this email. Sign in with your password first, then link this provider from settings." User must explicitly link.
- [ ] OAuth login round-trip (button click → session issued, excluding provider's own UI time) ≤ 5s p95.
- [ ] Generic OIDC: a system admin can register a custom provider via `PATCH /api/auth/oauth/providers/:providerkey` with `{ issuerurl, clientid, clientsecretref }`. The implementation discovers endpoints via the provider's `/.well-known/openid-configuration`.

### FR-018 — OAuth identity link / unlink

Authenticated users MUST be able to link additional OAuth identities to their existing account, with safety rules to prevent losing access.

**Acceptance Criteria**:

- [ ] `POST /api/auth/oauth/:provider/link` (authenticated) initiates a link flow. The OAuth callback handler reads `state.intent='link'` and adds the resolved identity as a new `oauthidentities` row for the calling user, instead of creating a new account.
- [ ] If the OAuth identity is already linked to a DIFFERENT user → HTTP 409 with no link performed.
- [ ] `GET /api/auth/oauth/identities` returns the caller's linked identities: `{ id, providerkey, displayname (from provider), email, linkedat, lastloginat }`.
- [ ] `DELETE /api/auth/oauth/identities/:id` unlinks. Blocked with HTTP 422 if the unlink would leave the user with NO sign-in method (no password AND no other linked OAuth identity).
- [ ] Linking and unlinking both write `authauditlog` rows with `eventtype: 'oauth_link'` / `eventtype: 'oauth_unlink'`.

---

## Data Requirements

| Table | Purpose |
| --- | --- |
| `users` | Primary identity row — one per human or agent |
| `sessions` | Active session tokens (opaque, hashed) |
| `refreshtokens` | Refresh tokens with rotation chain |
| `magiclinktokens` | Single-use email login links |
| `passwordresettokens` | Single-use password-reset links |
| `emailverificationtokens` | Single-use email verification |
| `orgmemberships` | Per-user-per-org role assignment (RBAC source of truth) |
| `orginvitations` | Pending org invites (emailed link) |
| `devicesessions` | Per-device session registry — joins to spec 008/009/001/010 deviceid |
| `agentapitokens` | Long-lived API tokens for AI agents |
| `oauthproviderconfigs` | Per-deployment registered OAuth providers |
| `oauthidentities` | Links a `users` row to an external OAuth identity |
| `authauditlog` | Append-only auth event log — 90-day retention |

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `email` | text | UNIQUE (case-insensitive citext) |
| `passwordhash` | text | Nullable — null for OAuth-only / agent accounts |
| `displayname` | text | |
| `kind` | text | `"human"` \| `"agent"` |
| `issystemadmin` | boolean | Default false |
| `isbillingadmin` | boolean | Default false |
| `issupport` | boolean | Default false |
| `plan` | text | `"individual"` \| `"corporate"` \| `"unset"` — set on signup per spec 012 FR-006; `"unset"` default for seeded users predating plan-aware signup |
| `emailverifiedat` | timestamptz | Nullable |
| `createdat` | timestamptz | |
| `updatedat` | timestamptz | |

### `sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK → users.id |
| `sessiontokenhash` | text | UNIQUE — SHA-256 of plaintext token |
| `deviceid` | text | Nullable — matches spec 008 / 009 / 001 / 010 deviceid |
| `useragent` | text | |
| `ipaddress` | inet | Anonymised before insert |
| `createdat` | timestamptz | |
| `lastusedat` | timestamptz | Updated on validated request |
| `expiresat` | timestamptz | 24h sliding |
| `revokedat` | timestamptz | Nullable |

Indexes: `(sessiontokenhash)` UNIQUE, `(userid, revokedat NULLS FIRST)`, `(deviceid)`.

### `refreshtokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK |
| `sessionid` | uuid | FK → sessions.id |
| `tokenhash` | text | UNIQUE |
| `familyid` | uuid | Same value across all tokens in a rotation chain |
| `replacedbyid` | uuid | Nullable self-FK |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | 30 days |
| `revokedat` | timestamptz | Nullable |

Indexes: `(tokenhash)` UNIQUE, `(familyid)`, `(userid, revokedat NULLS FIRST)`.

### `magiclinktokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `email` | text | Lookup key |
| `tokenhash` | text | UNIQUE — SHA-256 |
| `expiresat` | timestamptz | createdat + 10 min |
| `consumedat` | timestamptz | Nullable |
| `createdat` | timestamptz | |

### `passwordresettokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK |
| `tokenhash` | text | UNIQUE |
| `expiresat` | timestamptz | createdat + 15 min |
| `consumedat` | timestamptz | Nullable |
| `createdat` | timestamptz | |

### `emailverificationtokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK |
| `tokenhash` | text | UNIQUE |
| `expiresat` | timestamptz | createdat + 24h |
| `consumedat` | timestamptz | Nullable |
| `createdat` | timestamptz | |

### `orgmemberships`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK → users.id |
| `orgid` | uuid | FK → spec 001 orgs.id |
| `role` | text | `"owner"` \| `"admin"` \| `"member"` |
| `invitedby` | uuid | Nullable FK → users.id |
| `joinedat` | timestamptz | |
| `createdat` | timestamptz | |

UNIQUE constraint on `(userid, orgid)`. Indexes: `(userid)`, `(orgid, role)`.

### `orginvitations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `orgid` | uuid | FK |
| `email` | text | |
| `tokenhash` | text | UNIQUE |
| `role` | text | Pre-set role for the resulting membership |
| `invitedby` | uuid | FK |
| `expiresat` | timestamptz | createdat + 7 days |
| `consumedat` | timestamptz | Nullable |
| `createdat` | timestamptz | |

### `devicesessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK |
| `deviceid` | text | Matches spec 008/009/001/010 deviceid |
| `sessionid` | uuid | FK → sessions.id |
| `firstseenat` | timestamptz | |
| `lastseenat` | timestamptz | |
| `revokedat` | timestamptz | Nullable |

UNIQUE constraint on `(userid, deviceid, sessionid)`.

### `agentapitokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK → users.id (where kind = 'agent') |
| `name` | text | User-facing label |
| `tokenhash` | text | UNIQUE |
| `last6chars` | text | Last 6 chars of plaintext for display |
| `createdby` | uuid | FK → users.id |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | Nullable — null = never expires |
| `revokedat` | timestamptz | Nullable |

### `oauthproviderconfigs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `providerkey` | text | `"google"` \| `"apple"` \| `"microsoft"` \| `"github"` \| `"<custom-oidc-slug>"` — UNIQUE |
| `displayname` | text | E.g., "Google", "Sign in with Apple" |
| `clientid` | text | Nullable until configured |
| `clientsecretref` | text | Nullable — reference to secrets store (NEVER plaintext) |
| `issuerurl` | text | Nullable — for generic OIDC, base URL of `/.well-known/openid-configuration` |
| `enabled` | boolean | Default false |
| `createdat` | timestamptz | |
| `updatedat` | timestamptz | |

### `oauthidentities`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | FK → users.id |
| `providerkey` | text | FK → oauthproviderconfigs.providerkey |
| `subjectid` | text | The provider's stable user ID (e.g., Google `sub`) |
| `email` | text | As reported by provider |
| `emailverifiedbyprovider` | boolean | |
| `displayname` | text | |
| `avatarurl` | text | |
| `linkedat` | timestamptz | |
| `lastloginat` | timestamptz | |

UNIQUE constraint on `(providerkey, subjectid)`. Index on `(userid)`.

### `authauditlog`

Append-only — no UPDATE / DELETE outside the 90-day retention purge job.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | uuid | Nullable — null for events that pre-date a user (e.g., unsuccessful signup) |
| `eventtype` | text | `login` \| `login_failed` \| `logout` \| `signup` \| `force_signout` \| `family_revoke` \| `password_reset` \| `email_verified` \| `oauth_link` \| `oauth_unlink` \| `role_grant` \| `token_issue` \| `token_revoke` |
| `targetuserid` | uuid | Nullable — for admin actions affecting another user |
| `targetsessionid` | uuid | Nullable |
| `payload` | jsonb | Event-specific structured data |
| `ipaddress` | text | Anonymised — last octet (v4) or last 80 bits (v6) zeroed |
| `useragent` | text | |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | createdat + 90 days |

Index on `(userid, createdat DESC)` and `(eventtype, createdat DESC)`.

---

## API Routes

### Auth lifecycle

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Email + password signup; auto-creates personal org; sends verification email |
| POST | `/api/auth/login` | Email + password login; rate-limited |
| POST | `/api/auth/login/magic/request` | Request a magic link emailed to the address |
| GET | `/api/auth/login/magic/:token` | Consume magic link |
| POST | `/api/auth/refresh` | Rotate refresh token; on reuse, revokes whole family |
| POST | `/api/auth/logout` | Server revoke + WSEvent emit |
| POST | `/api/auth/password-reset/request` | Email a one-time reset link |
| POST | `/api/auth/password-reset/consume` | Consume token + set new password; invalidates existing sessions |
| POST | `/api/auth/email-verify/request` | Resend verification email |
| GET | `/api/auth/email-verify/:token` | Consume verification link |
| GET | `/api/auth/me` | Current user + active org + roles + flags |

### Sessions & devices

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth/sessions` | Caller's active sessions |
| POST | `/api/auth/sessions/:id/revoke` | Caller revokes their own session |
| POST | `/api/auth/sessions/:id/force-revoke` | Admin force sign-out (org-scope or system-wide) |

### Orgs & membership

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/orgs` | Create org with caller as owner |
| GET | `/api/orgs/:orgid/memberships` | List members + roles |
| POST | `/api/orgs/:orgid/invitations` | Owner/admin invites by email |
| POST | `/api/orgs/invitations/:token/accept` | Accept invitation |
| PATCH | `/api/orgs/:orgid/memberships/:userid` | Change role; sole-owner protection |
| DELETE | `/api/orgs/:orgid/memberships/:userid` | Remove member |

### System roles

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth/system-roles` | List users with any system flag (sysadmin/support) |
| PATCH | `/api/auth/system-roles/:userid` | Grant/revoke `issystemadmin` / `isbillingadmin` / `issupport` (sysadmin only) |

### Agent tokens

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth/agents/:agentid/tokens` | List tokens for an agent (last6chars only) |
| POST | `/api/auth/agents/:agentid/tokens` | Issue a new long-lived API token (returned once) |
| DELETE | `/api/auth/agents/:agentid/tokens/:tokenid` | Revoke a token |

### OAuth

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth/oauth/providers` | List enabled providers (no secrets) |
| GET | `/api/auth/oauth/:provider/start` | Initiate auth-code + PKCE flow |
| GET | `/api/auth/oauth/callback/:provider` | Provider callback — exchange code, issue session |
| GET | `/api/auth/oauth/identities` | Caller's linked OAuth identities |
| POST | `/api/auth/oauth/:provider/link` | Initiate link flow (authenticated) |
| DELETE | `/api/auth/oauth/identities/:id` | Unlink; last-method protection |
| PATCH | `/api/auth/oauth/providers/:providerkey` | System admin only — configure provider credentials |

---

## Frontend Components

### Auth surfaces

| Component | Path | Description |
| --- | --- | --- |
| `AuthGate` | `packages/ui/src/auth/AuthGate.tsx` | Root component; fetches `/api/auth/me`; renders `LoginScreen` if unauthenticated, children if authenticated; listens to `auth.signed_out` / `auth.force_signout` WSEvents |
| `AuthProvider` + `useAuth` | `packages/ui/src/auth/AuthContext.tsx` | Context: `{ user, org, hasRole(name), hasSystemFlag(flag), signIn, signOut, refresh }` |
| `LoginScreen` | `packages/ui/src/auth/LoginScreen.tsx` | Tabbed: email+password / magic link; `OAuthButtonRow` below; forgot-password link |
| `SignupForm` | `packages/ui/src/auth/SignupForm.tsx` | Email + password (zxcvbn meter) + display name |
| `LoginForm` | `packages/ui/src/auth/LoginForm.tsx` | Email + password; rate-limit UX shows `retry-after` countdown |
| `MagicLinkForm` | `packages/ui/src/auth/MagicLinkForm.tsx` | Email → request → "Check your email" confirmation |
| `PasswordResetRequestForm` | `packages/ui/src/auth/PasswordResetRequestForm.tsx` | Email field → POST request |
| `PasswordResetForm` | `packages/ui/src/auth/PasswordResetForm.tsx` | New password + confirm; consumes link token |
| `EmailVerificationBanner` | `packages/ui/src/auth/EmailVerificationBanner.tsx` | Persistent banner when `emailverifiedat IS NULL` with Resend action |
| `OAuthButtonRow` | `packages/ui/src/auth/OAuthButtonRow.tsx` | One button per enabled provider; rendered in `LoginScreen` and `SignupForm` |

### Account & session management

| Component | Path | Description |
| --- | --- | --- |
| `DeviceSessionsList` | `packages/ui/src/auth/DeviceSessionsList.tsx` | Caller's active sessions with Revoke per row |
| `LinkedIdentitiesPanel` | `packages/ui/src/auth/LinkedIdentitiesPanel.tsx` | Linked OAuth identities + sign-in-method count; Link another / Unlink |
| `OrgInviteAcceptScreen` | `packages/ui/src/auth/OrgInviteAcceptScreen.tsx` | Linked from invitation email; signed-out users sign up first |
| `OrgMembershipManager` | `packages/ui/src/auth/OrgMembershipManager.tsx` | Owner/admin UI to invite, change role, remove |
| `SystemRoleManager` | `packages/ui/src/auth/SystemRoleManager.tsx` | `issystemadmin`-only — toggle the three system flags |

### Listeners (mounted in `AuthGate`)

| Component | Path | Description |
| --- | --- | --- |
| `ForceSignoutListener` | `packages/ui/src/auth/ForceSignoutListener.tsx` | Subscribes to `auth.force_signout`; triggers logout on matching device |
| `RefreshFamilyRevokedListener` | `packages/ui/src/auth/RefreshFamilyRevokedListener.tsx` | Subscribes to `auth.signed_out`; logs out instantly |

---

## Success Criteria

1. Email+password sign-up → first authenticated screen ≤ 10s p95.
2. OAuth login (Google/Apple/Microsoft/GitHub) end-to-end ≤ 5s p95, excluding the provider's own UI time.
3. Password reset round-trip (request → email → consume → new session) ≤ 60s including a real email send.
4. Admin route access denied 100% of the time when caller lacks the required role — verified by an authorization test matrix on every CI build.
5. Logout client-side `SecureKeyStore.clearUser` completes in ≤ 500ms p95; server-side family revoke + WSEvent emit in ≤ 500ms p95.
6. Org-scoped queries leak zero rows from other orgs in isolation tests across `skills`, `assistantsessions`, `aiproviders`, `panotifications`, `pushtokens`, `oauthidentities`, `agentapitokens`, `messages`.
7. Forced sign-out propagates to the target device via WebSocket in ≤ 2s p95.
8. Refresh-token reuse detection revokes the entire token family in ≤ 1s and emits a `pa.notification` to the legitimate user in ≤ 5s.
9. Auth audit log captures 100% of: signup, login (success + failure), OAuth link/unlink, password reset, force sign-out, role grant/revoke, token issue/revoke, family revoke. Retained 90 days.
10. First-launch bootstrap is idempotent — if `BOOTSTRAP_ADMIN_EMAIL` is set and a system admin already exists, the bootstrap path is a no-op.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `User` | `users` | One row per identity — human or agent. Holds the three system flags. |
| `Session` | `sessions` | An active opaque session token. Revocation is real-time. |
| `RefreshToken` | `refreshtokens` | One rotation step in a session family. Family revocation on reuse. |
| `OrgMembership` | `orgmemberships` | Per-user-per-org role assignment — the RBAC source of truth. |
| `OAuthIdentity` | `oauthidentities` | A linked external identity (Google/Apple/Microsoft/GitHub/custom OIDC). |
| `DeviceSession` | `devicesessions` | Join row tying userid + deviceid + sessionid for the cross-spec deviceid contract. |
| `AgentApiToken` | `agentapitokens` | Long-lived API token for an AI agent per spec 001 FR-010. |
| `AuthAuditEntry` | `authauditlog` | Append-only audit row for SOC 2 evidence. 90-day retention. |

---

## Constraints

- Passwords NEVER stored in plaintext. Argon2id only, with parameters matching spec 010 FR-002 (m_cost 64MB, t_cost 3, parallelism 1). Any other KDF — bcrypt, PBKDF2, scrypt — is a hard violation.
- All tokens (session, refresh, magic-link, password-reset, email-verification, agent API, org invitation) are stored hashed (SHA-256). The plaintext token is shown to the user exactly once at issuance.
- No JWTs anywhere in this scope. Opaque tokens only — required for real-time revocation (force-signout, family-revoke).
- All `/api/auth/*` and `/api/orgs/*` endpoints require TLS 1.2+. HTTP only permitted on localhost in development.
- The `authauditlog` table is append-only. No UPDATE, no DELETE except by the 90-day retention purge job.
- IP addresses in audit log are anonymised (last octet zeroed for IPv4, last 80 bits for IPv6).
- OAuth identities are NEVER auto-linked to existing accounts by email match. Linking is an explicit, authenticated user action only (SOC 2 — prevents account takeover via attacker-controlled OAuth account).
- Refresh-token rotation is mandatory. Reuse detection MUST revoke the entire token family plus all linked session tokens. Single-token rotation without family revoke is a hard violation.
- Bootstrap is idempotent. `BOOTSTRAP_ADMIN_EMAIL` is read only on first-launch when no `users.issystemadmin=true` row exists.
- Sole-owner protection on `orgmemberships`: an org MUST always have at least one `role='owner'`. Demoting the last owner returns HTTP 422.
- Last-sign-in-method protection on `oauthidentities` + `users.passwordhash`: a user MUST always have at least one method to sign in.
- Org admins can force-sign-out only users in their org. System admins can force-sign-out anyone. Enforced at the API layer.
- Auth middleware MUST validate session tokens in ≤ 5ms p95. Spec 003 WebSocket connect-time validation is bounded by this.
- Pairing prerequisite: `/api/keybackup/pairing/start` returns 401 if unauthenticated. Spec 003 subscription auth to `pairing:{id}` checks an authenticated session.
- The two-tier RBAC model (per-org role + system flags) MUST be enforced through a single `requireAuth({ orgRole?, systemFlag? })` middleware. Bespoke per-route auth checks are a hard violation.
- `oauthproviderconfigs.clientsecretref` is a reference into the secrets store — never the plaintext secret. Implementation checklist forbids storing plaintext.

---

## Notes

### Relationship to other specs

| Spec | How spec 011 connects |
| --- | --- |
| **Spec 001** | `users.id` is the canonical `userid` referenced by `userencryptionkeys`, `messages`, `agents`, `orgmembers`. Spec 001's `orgs` table is reused; spec 011 adds `orgmemberships` for RBAC. |
| **Spec 002** | `aiproviders` per-user scoping uses `users.id`. `aiproviders.isdefault=true` can only be set by a system admin. The PA channel notification SDK (spec 002 FR-017) is called by spec 011 for security alerts. |
| **Spec 003** | WS connect-time auth token validation calls spec 011's session validation. The `auth.signed_out`, `auth.force_signout` event types are published by spec 011 to spec 003's WS broker. |
| **Spec 008** | `AuthGate` is consumed by spec 008 FR-012 (mobile shell root). `SecureKeyStore.clearUser(userid)` is called on logout. The same `deviceid` joins `users` ↔ `mobiledevices` ↔ `sessions`. |
| **Spec 009** | Push tokens are per-user-per-device using the same `deviceid`. Logout clears push tokens for that device via spec 009 `DELETE /api/push/tokens`. |
| **Spec 010** | Pairing requires an authenticated new device. Recovery-attempt alerts use spec 002 FR-017 SDK. |
| **Spec 013 (Admin Console — to be drafted)** | Consumes system-admin flags + org-admin role checks to render scope-appropriate views. Cross-org views require `issystemadmin=true`. |

### OAuth library choice

Inherits spec 002 FR-016's pending OAuth library decision (Better Auth / Arctic / Nango). Whichever is picked there is reused here — one library handles both `/api/integrations/oauth/...` (service bindings) and `/api/auth/oauth/...` (user login). The choice doesn't materially affect this spec's FRs.

### Bootstrap workflow

1. Operator sets `BOOTSTRAP_ADMIN_EMAIL=...` in deployment env (`.env.production`).
2. Server starts; bootstrap step runs: if `SELECT count(*) FROM users WHERE issystemadmin = true` is 0, INSERT a new `users` row OR UPDATE the existing matching-email row to set `issystemadmin=true` AND `isbillingadmin=true`. Writes `authauditlog` row with `eventtype: 'role_grant'`, `payload: { reason: 'bootstrap' }`.
3. The granted user receives BOTH a PA channel notification (via spec 002 FR-017 SDK) AND an email — covers the cold-start case where the PA channel isn't yet configured.
4. If `BOOTSTRAP_ADMIN_EMAIL` is invalid OR no users row can be created/updated, bootstrap logs an error and exits non-zero. Subsequent runs retry until success.

### Risks

| Risk | Mitigation |
| --- | --- |
| **Email deliverability** — verification, magic-link, password-reset, OAuth-link emails degrade silently with misconfigured SMTP | Health check pings the email service every 5 min; failure surfaces in spec 013 admin console |
| **OAuth provider outage** cascades into login failure for users who linked that provider | Users with any other sign-in method fall back automatically; LoginScreen shows all methods |
| **Refresh-token reuse false positive** under flaky networks | 5-second grace window where the immediately-previous token is also accepted |
| **`BOOTSTRAP_ADMIN_EMAIL` leakage in env files committed to source control** | Documented in deployment guide; bootstrap event is audit-logged so a misconfigured email surfaces immediately |
| **Account enumeration via signup or password-reset response timing** | Both endpoints return the SAME response regardless of whether the email exists |
| **Argon2id parameters too slow on weak hardware** | Configurable via env (`AUTH_ARGON2_MEMORY_KIB`, `AUTH_ARGON2_ITERATIONS`); defaults match spec 010 |
| **`oauthproviderconfigs.clientsecret` mis-stored as plaintext during development** | Column named `clientsecretref` (a reference); CI test rejects schemas that name it `clientsecret` |
| **Admin signs themselves out** (footgun) | UI confirms with the user's email and "you are signing yourself out from this device" warning |

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Where do org-admin vs system-admin roles live? | Two-tier: per-org `orgmemberships.role` (owner/admin/member) + three independent system flags on `users` (`issystemadmin`, `isbillingadmin`, `issupport`) |
| 2 | How is the first system admin granted? | `BOOTSTRAP_ADMIN_EMAIL` env var, idempotent on first launch when no system admin exists. That user also gets `isbillingadmin=true` initially. |
| 3 | Token format — JWT or opaque? | Opaque. Required for real-time revocation (force-signout, family-revoke). |
| 4 | OAuth auto-link by matching email? | No — explicit user link only. SOC 2 (prevents account takeover via attacker-controlled OAuth account). |
| 5 | Which OAuth providers in v1? | Google, Apple, Microsoft, GitHub (built-in seeded but `enabled=false` until configured) + generic OIDC for self-hosted SSO. Full SAML deferred to v2. |
| 6 | Apple sign-in required? | Yes — App Store compliance for spec 008 iOS app. |
| 7 | Email verification gating? | Required for signup; banner blocks initial high-trust actions. Verification token in `emailverificationtokens` (24h TTL). |
| 8 | Admin dashboard? | Out of spec 011. Spec 013 (Admin Console) — to be drafted after 011. Spec 011 provides the role primitives + middleware. |
| 9 | Pairing authentication assumption (from spec 010 D3)? | Resolved here: `/api/keybackup/pairing/start` is auth-required; spec 003 subscription to `pairing:{id}` checks an authenticated session. |
| 10 | Bootstrap admin notification — PA channel only or also email? | Both. PA notification AND email — covers the cold-start case where the PA channel isn't yet configured. |
