# Test Plan: wxKanban Company Chat API

**Spec Number**: 093
**Date Generated**: 2026-10-24
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

### UT-001 — T001 Consumer API guard: secret, rate limit and audit helper (FR-001, FR-007)

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T001 Consumer API guard: secret, rate limit and audit helper (FR-001, FR-007) — happy path | Success response | pending |
| 2 | T001 Consumer API guard: secret, rate limit and audit helper (FR-001, FR-007) — validation error | Error with details | pending |
| 3 | T001 Consumer API guard: secret, rate limit and audit helper (FR-001, FR-007) — edge case | Graceful handling | pending |

### UT-002 — T002 POST /api/consumer/accounts: create or link by email, welcome email when new (FR-002)

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T002 POST /api/consumer/accounts: create or link by email, welcome email when new (FR-002) — happy path | Success response | pending |
| 2 | T002 POST /api/consumer/accounts: create or link by email, welcome email when new (FR-002) — validation error | Error with details | pending |
| 3 | T002 POST /api/consumer/accounts: create or link by email, welcome email when new (FR-002) — edge case | Graceful handling | pending |

### UT-003 — T003 Company group: POST /api/consumer/groups and PATCH seat limit (FR-003)

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T003 Company group: POST /api/consumer/groups and PATCH seat limit (FR-003) — happy path | Success response | pending |
| 2 | T003 Company group: POST /api/consumer/groups and PATCH seat limit (FR-003) — validation error | Error with details | pending |
| 3 | T003 Company group: POST /api/consumer/groups and PATCH seat limit (FR-003) — edge case | Graceful handling | pending |

### UT-004 — T004 Group members: PUT and DELETE /api/consumer/groups/:orgid/members/:userid (FR-004)

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T004 Group members: PUT and DELETE /api/consumer/groups/:orgid/members/:userid (FR-004) — happy path | Success response | pending |
| 2 | T004 Group members: PUT and DELETE /api/consumer/groups/:orgid/members/:userid (FR-004) — validation error | Error with details | pending |
| 3 | T004 Group members: PUT and DELETE /api/consumer/groups/:orgid/members/:userid (FR-004) — edge case | Graceful handling | pending |

### UT-005 — T005 Project rooms: POST /api/consumer/rooms and PUT/DELETE room members (FR-005)

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T005 Project rooms: POST /api/consumer/rooms and PUT/DELETE room members (FR-005) — happy path | Success response | pending |
| 2 | T005 Project rooms: POST /api/consumer/rooms and PUT/DELETE room members (FR-005) — validation error | Error with details | pending |
| 3 | T005 Project rooms: POST /api/consumer/rooms and PUT/DELETE room members (FR-005) — edge case | Graceful handling | pending |

### UT-006 — T006 Retire a room: conversations.retiredat, retire endpoint, list filter, post refusal on every path (FR-006)

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T006 Retire a room: conversations.retiredat, retire endpoint, list filter, post refusal on every path (FR-006) — happy path | Success response | pending |
| 2 | T006 Retire a room: conversations.retiredat, retire endpoint, list filter, post refusal on every path (FR-006) — validation error | Error with details | pending |
| 3 | T006 Retire a room: conversations.retiredat, retire endpoint, list filter, post refusal on every path (FR-006) — edge case | Graceful handling | pending |

### UT-007 — T007 Regression: existing consumer session, org and invitation behavior unchanged (FR-008)

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T007 Regression: existing consumer session, org and invitation behavior unchanged (FR-008) — happy path | Success response | pending |
| 2 | T007 Regression: existing consumer session, org and invitation behavior unchanged (FR-008) — validation error | Error with details | pending |
| 3 | T007 Regression: existing consumer session, org and invitation behavior unchanged (FR-008) — edge case | Graceful handling | pending |

### UT-008 — T008 Acceptance: US1 to US6 and the success metrics

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | T008 Acceptance: US1 to US6 and the success metrics — happy path | Success response | pending |
| 2 | T008 Acceptance: US1 to US6 and the success metrics — validation error | Error with details | pending |
| 3 | T008 Acceptance: US1 to US6 and the success metrics — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full wxKanban Company Chat API workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes wxKanban Company Chat API | Success | pending |
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
