# Test Plan: Mobile Shell and App Packaging

**Spec Number**: 008
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

### UT-001 — Expo project scaffolding + custom dev client + EAS build/submit/update pipelines

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Expo project scaffolding + custom dev client + EAS build/submit/update pipelines — happy path | Success response | pending |
| 2 | Expo project scaffolding + custom dev client + EAS build/submit/update pipelines — validation error | Error with details | pending |
| 3 | Expo project scaffolding + custom dev client + EAS build/submit/update pipelines — edge case | Graceful handling | pending |

### UT-002 — Shared UI reuse: packages/ui + useResponsive + packages/platform adapter

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Shared UI reuse: packages/ui + useResponsive + packages/platform adapter — happy path | Success response | pending |
| 2 | Shared UI reuse: packages/ui + useResponsive + packages/platform adapter — validation error | Error with details | pending |
| 3 | Shared UI reuse: packages/ui + useResponsive + packages/platform adapter — edge case | Graceful handling | pending |

### UT-003 — MobileLifecycle event stream + WS reconnect + SSE abort + memory_warning

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | MobileLifecycle event stream + WS reconnect + SSE abort + memory_warning — happy path | Success response | pending |
| 2 | MobileLifecycle event stream + WS reconnect + SSE abort + memory_warning — validation error | Error with details | pending |
| 3 | MobileLifecycle event stream + WS reconnect + SSE abort + memory_warning — edge case | Graceful handling | pending |

### UT-004 — SecureKeyStore: cross-platform secure local storage for E2E private keys

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | SecureKeyStore: cross-platform secure local storage for E2E private keys — happy path | Success response | pending |
| 2 | SecureKeyStore: cross-platform secure local storage for E2E private keys — validation error | Error with details | pending |
| 3 | SecureKeyStore: cross-platform secure local storage for E2E private keys — edge case | Graceful handling | pending |

### UT-005 — Permission flows with in-context rationale + Settings redirect for denied permissions

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Permission flows with in-context rationale + Settings redirect for denied permissions — happy path | Success response | pending |
| 2 | Permission flows with in-context rationale + Settings redirect for denied permissions — validation error | Error with details | pending |
| 3 | Permission flows with in-context rationale + Settings redirect for denied permissions — edge case | Graceful handling | pending |

### UT-006 — Native video stack (LiveKit) + Deep linking router + Force-upgrade gate

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Native video stack (LiveKit) + Deep linking router + Force-upgrade gate — happy path | Success response | pending |
| 2 | Native video stack (LiveKit) + Deep linking router + Force-upgrade gate — validation error | Error with details | pending |
| 3 | Native video stack (LiveKit) + Deep linking router + Force-upgrade gate — edge case | Graceful handling | pending |

### UT-007 — Crash reporting (Sentry) + session telemetry with PII redaction

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Crash reporting (Sentry) + session telemetry with PII redaction — happy path | Success response | pending |
| 2 | Crash reporting (Sentry) + session telemetry with PII redaction — validation error | Error with details | pending |
| 3 | Crash reporting (Sentry) + session telemetry with PII redaction — edge case | Graceful handling | pending |

### UT-008 — Per-device install registry + AuthGate mount + linking points for spec 009 / spec 011

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Per-device install registry + AuthGate mount + linking points for spec 009 / spec 011 — happy path | Success response | pending |
| 2 | Per-device install registry + AuthGate mount + linking points for spec 009 / spec 011 — validation error | Error with details | pending |
| 3 | Per-device install registry + AuthGate mount + linking points for spec 009 / spec 011 — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Mobile Shell and App Packaging workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Mobile Shell and App Packaging | Success | pending |
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
