# Test Plan: Authentication and Authorization

**Spec Number**: 011
**Date Generated**: 2026-05-24
**Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

---

## Test Strategy

| Layer | Framework | Coverage Target |
|-------|-----------|-----------------|
| Unit | Vitest | Core logic, services, utilities |
| Integration | Vitest + Supertest | API endpoints, DB operations |
| E2E | Playwright | User workflows, critical paths |

---

## Unit Tests

### UT-001 — Core data model + opaque-token primitives + requireAuth middleware

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Core data model + opaque-token primitives + requireAuth middleware — happy path | Success response | pending |
| 2 | Core data model + opaque-token primitives + requireAuth middleware — validation error | Error with details | pending |
| 3 | Core data model + opaque-token primitives + requireAuth middleware — edge case | Graceful handling | pending |

### UT-002 — Email+password signup/login + email verification + password reset

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Email+password signup/login + email verification + password reset — happy path | Success response | pending |
| 2 | Email+password signup/login + email verification + password reset — validation error | Error with details | pending |
| 3 | Email+password signup/login + email verification + password reset — edge case | Graceful handling | pending |

### UT-003 — Magic-link / email-OTP passwordless login

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Magic-link / email-OTP passwordless login — happy path | Success response | pending |
| 2 | Magic-link / email-OTP passwordless login — validation error | Error with details | pending |
| 3 | Magic-link / email-OTP passwordless login — edge case | Graceful handling | pending |

### UT-004 — Refresh-token rotation with reuse detection + logout + WS propagation + SecureKeyStore.clearUser

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Refresh-token rotation with reuse detection + logout + WS propagation + SecureKeyStore.clearUser — happy path | Success response | pending |
| 2 | Refresh-token rotation with reuse detection + logout + WS propagation + SecureKeyStore.clearUser — validation error | Error with details | pending |
| 3 | Refresh-token rotation with reuse detection + logout + WS propagation + SecureKeyStore.clearUser — edge case | Graceful handling | pending |

### UT-005 — Org membership + invitations + system flags + bootstrap admin

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Org membership + invitations + system flags + bootstrap admin — happy path | Success response | pending |
| 2 | Org membership + invitations + system flags + bootstrap admin — validation error | Error with details | pending |
| 3 | Org membership + invitations + system flags + bootstrap admin — edge case | Graceful handling | pending |

### UT-006 — Force sign-out + device session registry + agent API tokens + spec 010 pairing prerequisite

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Force sign-out + device session registry + agent API tokens + spec 010 pairing prerequisite — happy path | Success response | pending |
| 2 | Force sign-out + device session registry + agent API tokens + spec 010 pairing prerequisite — validation error | Error with details | pending |
| 3 | Force sign-out + device session registry + agent API tokens + spec 010 pairing prerequisite — edge case | Graceful handling | pending |

### UT-007 — OAuth/OIDC providers + login + link/unlink (Google, Apple, Microsoft, GitHub, generic OIDC)

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | OAuth/OIDC providers + login + link/unlink (Google, Apple, Microsoft, GitHub, generic OIDC) — happy path | Success response | pending |
| 2 | OAuth/OIDC providers + login + link/unlink (Google, Apple, Microsoft, GitHub, generic OIDC) — validation error | Error with details | pending |
| 3 | OAuth/OIDC providers + login + link/unlink (Google, Apple, Microsoft, GitHub, generic OIDC) — edge case | Graceful handling | pending |

### UT-008 — Frontend auth surface: AuthGate, useAuth/AuthContext, login/signup/reset forms, account-management UIs, WS listeners

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Frontend auth surface: AuthGate, useAuth/AuthContext, login/signup/reset forms, account-management UIs, WS listeners — happy path | Success response | pending |
| 2 | Frontend auth surface: AuthGate, useAuth/AuthContext, login/signup/reset forms, account-management UIs, WS listeners — validation error | Error with details | pending |
| 3 | Frontend auth surface: AuthGate, useAuth/AuthContext, login/signup/reset forms, account-management UIs, WS listeners — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Authentication and Authorization workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Authentication and Authorization | Success | pending |
| 2 | Error recovery | User encounters and recovers from error | Guided recovery | pending |

## Test Automation

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Coverage Requirements

- Unit test coverage: >= 80%
- All acceptance criteria from spec must have at least one test
- All API endpoints must have integration tests
- Critical user flows must have E2E tests
