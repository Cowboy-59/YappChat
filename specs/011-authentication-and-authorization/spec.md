# Spec 011: Authentication and Authorization

## Overview

Authentication & Authorization is the identity backbone every other YappChat scope assumes exists. Specs 001–010 reference "the caller is authenticated", "admin routes are admin-only", and "this user's session", but no scope owns the actual sign-up, login, session, role, or org-membership data model. Spec 011 fills that hole.

The scope covers the full lifecycle: email-and-password signup with argon2id hashing, magic-link/OTP as a passwordless alternative, OAuth/OIDC login with configurable providers (Google, Apple, Microsoft, GitHub built-in plus generic OIDC for self-hosted SSO), opaque session tokens with refresh-token rotation and reuse detection, password reset by emailed one-time link, three-role per-org RBAC (owner / admin / member), three independent system-level flags on the user (`issystemadmin`, `isbillingadmin`, `issupport`), org creation and membership, the `AuthGate` component spec 008 already references, the `useAuth` hook every UI surface consumes, logout that calls `SecureKeyStore.clearUser` for clean key isolation, a device session registry distinct from but linked to spec 008's `mobiledevices` and spec 009's `pushtokens`, admin-triggered forced sign-out propagated over WebSocket, and AI agent API token issuance per spec 001 FR-010.

Spec 011 is also the prerequisite for spec 010's pairing flow (a new device must be authenticated *before* it can begin pairing) and for the spec 003 capacity-alert recipient (the admin user identified by an admin role, not a hard-coded email).

**Two-tier RBAC**: System-level booleans on `users` (`issystemadmin` / `isbillingadmin` / `issupport`, any combination) are orthogonal to per-org `orgmemberships.role` (`owner` / `admin` / `member`). YappChat staff have system flags and no org memberships; ordinary users have no system flags and `owner` of their personal org. Both layers can co-exist on one user.

**Scope Boundary** — IN SCOPE: email+password signup (argon2id, m_cost 64MB / t_cost 3); magic-link / email-OTP; OAuth/OIDC with built-in Google / Apple / Microsoft / GitHub providers + generic OIDC; opaque session tokens with sub-5ms validation; refresh-token rotation with 5-second grace window and family-revoke on reuse detection; password reset; three-role per-org RBAC; three independent system flags; first-system-admin bootstrap from `BOOTSTRAP_ADMIN_EMAIL`; system-admin grant/revoke API; org creation + email invitations + sole-owner protection; `AuthGate` + `useAuth` + `AuthContext`; logout flow that calls `SecureKeyStore.clearUser`; device session registry sharing `deviceid` with specs 001/008/009/010; admin force-sign-out propagated over WebSocket; AI agent API token issuance and revocation; spec 010 pairing prerequisite. OUT OF SCOPE: SAML and Google Workspace domain federation; biometric unlock (spec 008); MFA/TOTP; user impersonation tooling; GDPR right-to-erasure / account deletion compliance flows.

**Depends On**: Spec 001 (userid joins, orgs table), Spec 002 (FR-017 PA notification SDK, FR-016 OAuth library), Spec 003 (WS auth + event publish), Spec 008 (SecureKeyStore.clearUser, AuthGate consumer), Spec 010 (pairing prerequisite).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
