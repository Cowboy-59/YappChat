# Test Plan: Push Notifications

**Spec Number**: 009
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

### UT-001 — Push token registry: pushtokens / notificationpreferences / pushdeliveries / pushtaps tables + token-registration APIs

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Push token registry: pushtokens / notificationpreferences / pushdeliveries / pushtaps tables + token-registration APIs — happy path | Success response | pending |
| 2 | Push token registry: pushtokens / notificationpreferences / pushdeliveries / pushtaps tables + token-registration APIs — validation error | Error with details | pending |
| 3 | Push token registry: pushtokens / notificationpreferences / pushdeliveries / pushtaps tables + token-registration APIs — edge case | Graceful handling | pending |

### UT-002 — Foreground-aware fanout worker: WSBroker subscriber + lifecycle ping + push-vs-no-push decision matrix

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Foreground-aware fanout worker: WSBroker subscriber + lifecycle ping + push-vs-no-push decision matrix — happy path | Success response | pending |
| 2 | Foreground-aware fanout worker: WSBroker subscriber + lifecycle ping + push-vs-no-push decision matrix — validation error | Error with details | pending |
| 3 | Foreground-aware fanout worker: WSBroker subscriber + lifecycle ping + push-vs-no-push decision matrix — edge case | Graceful handling | pending |

### UT-003 — Event-to-payload mapping registry: src/server/push/event-mappings.ts with full default mapping table

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Event-to-payload mapping registry: src/server/push/event-mappings.ts with full default mapping table — happy path | Success response | pending |
| 2 | Event-to-payload mapping registry: src/server/push/event-mappings.ts with full default mapping table — validation error | Error with details | pending |
| 3 | Event-to-payload mapping registry: src/server/push/event-mappings.ts with full default mapping table — edge case | Graceful handling | pending |

### UT-004 — APNs (iOS) provider adapter with token-auth + sandbox/production environment routing

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | APNs (iOS) provider adapter with token-auth + sandbox/production environment routing — happy path | Success response | pending |
| 2 | APNs (iOS) provider adapter with token-auth + sandbox/production environment routing — validation error | Error with details | pending |
| 3 | APNs (iOS) provider adapter with token-auth + sandbox/production environment routing — edge case | Graceful handling | pending |

### UT-005 — FCM (Android) provider adapter with notification channels + doze guidance

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | FCM (Android) provider adapter with notification channels + doze guidance — happy path | Success response | pending |
| 2 | FCM (Android) provider adapter with notification channels + doze guidance — validation error | Error with details | pending |
| 3 | FCM (Android) provider adapter with notification channels + doze guidance — edge case | Graceful handling | pending |

### UT-006 — Web Push provider adapter: VAPID auth + service worker + browser subscription flow

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Web Push provider adapter: VAPID auth + service worker + browser subscription flow — happy path | Success response | pending |
| 2 | Web Push provider adapter: VAPID auth + service worker + browser subscription flow — validation error | Error with details | pending |
| 3 | Web Push provider adapter: VAPID auth + service worker + browser subscription flow — edge case | Graceful handling | pending |

### UT-007 — Silent-push-then-fetch flow + 30s visible-push fallback timer + ack endpoint + delivery analytics + rate limiting

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Silent-push-then-fetch flow + 30s visible-push fallback timer + ack endpoint + delivery analytics + rate limiting — happy path | Success response | pending |
| 2 | Silent-push-then-fetch flow + 30s visible-push fallback timer + ack endpoint + delivery analytics + rate limiting — validation error | Error with details | pending |
| 3 | Silent-push-then-fetch flow + 30s visible-push fallback timer + ack endpoint + delivery analytics + rate limiting — edge case | Graceful handling | pending |

### UT-008 — Client handlers (PushHandler, web subscription, service worker) + NotificationSettingsScreen + preferences API

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Client handlers (PushHandler, web subscription, service worker) + NotificationSettingsScreen + preferences API — happy path | Success response | pending |
| 2 | Client handlers (PushHandler, web subscription, service worker) + NotificationSettingsScreen + preferences API — validation error | Error with details | pending |
| 3 | Client handlers (PushHandler, web subscription, service worker) + NotificationSettingsScreen + preferences API — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Push Notifications workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Push Notifications | Success | pending |
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
