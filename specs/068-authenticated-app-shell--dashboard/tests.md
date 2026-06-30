# Test Plan: Authenticated App Shell + Dashboard

**Spec Number**: 068
**Date Generated**: 2026-06-23
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

### UT-001 — Account profile schema + session widening

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Account profile schema + session widening — happy path | Success response | pending |
| 2 | Account profile schema + session widening — validation error | Error with details | pending |
| 3 | Account profile schema + session widening — edge case | Graceful handling | pending |

### UT-002 — Profile read/update endpoint + service

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Profile read/update endpoint + service — happy path | Success response | pending |
| 2 | Profile read/update endpoint + service — validation error | Error with details | pending |
| 3 | Profile read/update endpoint + service — edge case | Graceful handling | pending |

### UT-003 — Per-community availability setter

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Per-community availability setter — happy path | Success response | pending |
| 2 | Per-community availability setter — validation error | Error with details | pending |
| 3 | Per-community availability setter — edge case | Graceful handling | pending |

### UT-004 — Authenticated route-group shell + sidebar

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Authenticated route-group shell + sidebar — happy path | Success response | pending |
| 2 | Authenticated route-group shell + sidebar — validation error | Error with details | pending |
| 3 | Authenticated route-group shell + sidebar — edge case | Graceful handling | pending |

### UT-005 — Dashboard home + client islands

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Dashboard home + client islands — happy path | Success response | pending |
| 2 | Dashboard home + client islands — validation error | Error with details | pending |
| 3 | Dashboard home + client islands — edge case | Graceful handling | pending |

### UT-006 — Return-url allow-list extension + tests

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Return-url allow-list extension + tests — happy path | Success response | pending |
| 2 | Return-url allow-list extension + tests — validation error | Error with details | pending |
| 3 | Return-url allow-list extension + tests — edge case | Graceful handling | pending |

### UT-007 — Verification

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Verification — happy path | Success response | pending |
| 2 | Verification — validation error | Error with details | pending |
| 3 | Verification — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Authenticated App Shell + Dashboard workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Authenticated App Shell + Dashboard | Success | pending |
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
