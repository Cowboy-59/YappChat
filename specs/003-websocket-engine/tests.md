# Test Plan: WebSocket Engine

**Spec Number**: 003
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

### UT-001 — WebSocket server + connection lifecycle + auth token validation + wssessions registry

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | WebSocket server + connection lifecycle + auth token validation + wssessions registry — happy path | Success response | pending |
| 2 | WebSocket server + connection lifecycle + auth token validation + wssessions registry — validation error | Error with details | pending |
| 3 | WebSocket server + connection lifecycle + auth token validation + wssessions registry — edge case | Graceful handling | pending |

### UT-002 — Subscription management with scope authorization (user/channel/org/agent/videoroom/pairing/broadcast)

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Subscription management with scope authorization (user/channel/org/agent/videoroom/pairing/broadcast) — happy path | Success response | pending |
| 2 | Subscription management with scope authorization (user/channel/org/agent/videoroom/pairing/broadcast) — validation error | Error with details | pending |
| 3 | Subscription management with scope authorization (user/channel/org/agent/videoroom/pairing/broadcast) — edge case | Graceful handling | pending |

### UT-003 — Event envelope + WSBroker abstraction (LocalBroker default, RedisBroker designed-in) + event routing pipeline

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Event envelope + WSBroker abstraction (LocalBroker default, RedisBroker designed-in) + event routing pipeline — happy path | Success response | pending |
| 2 | Event envelope + WSBroker abstraction (LocalBroker default, RedisBroker designed-in) + event routing pipeline — validation error | Error with details | pending |
| 3 | Event envelope + WSBroker abstraction (LocalBroker default, RedisBroker designed-in) + event routing pipeline — edge case | Graceful handling | pending |

### UT-004 — Heartbeat + ping-pong + dead-connection detection + client-level heartbeat

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Heartbeat + ping-pong + dead-connection detection + client-level heartbeat — happy path | Success response | pending |
| 2 | Heartbeat + ping-pong + dead-connection detection + client-level heartbeat — validation error | Error with details | pending |
| 3 | Heartbeat + ping-pong + dead-connection detection + client-level heartbeat — edge case | Graceful handling | pending |

### UT-005 — Event log for replay on reconnect: wsevents table + 5-minute TTL + resume handshake + cleanup job

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Event log for replay on reconnect: wsevents table + 5-minute TTL + resume handshake + cleanup job — happy path | Success response | pending |
| 2 | Event log for replay on reconnect: wsevents table + 5-minute TTL + resume handshake + cleanup job — validation error | Error with details | pending |
| 3 | Event log for replay on reconnect: wsevents table + 5-minute TTL + resume handshake + cleanup job — edge case | Graceful handling | pending |

### UT-006 — Presence + typing indicators (in-memory, ephemeral)

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Presence + typing indicators (in-memory, ephemeral) — happy path | Success response | pending |
| 2 | Presence + typing indicators (in-memory, ephemeral) — validation error | Error with details | pending |
| 3 | Presence + typing indicators (in-memory, ephemeral) — edge case | Graceful handling | pending |

### UT-007 — Capacity monitoring + 70%/90% PA alerts + RedisBroker implementation + GET /api/ws/stats

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Capacity monitoring + 70%/90% PA alerts + RedisBroker implementation + GET /api/ws/stats — happy path | Success response | pending |
| 2 | Capacity monitoring + 70%/90% PA alerts + RedisBroker implementation + GET /api/ws/stats — validation error | Error with details | pending |
| 3 | Capacity monitoring + 70%/90% PA alerts + RedisBroker implementation + GET /api/ws/stats — edge case | Graceful handling | pending |

### UT-008 — Client library WSClient + React integration (WSProvider, useWSEvent, usePresence, useTypingIndicator, WSStatusIndicator)

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Client library WSClient + React integration (WSProvider, useWSEvent, usePresence, useTypingIndicator, WSStatusIndicator) — happy path | Success response | pending |
| 2 | Client library WSClient + React integration (WSProvider, useWSEvent, usePresence, useTypingIndicator, WSStatusIndicator) — validation error | Error with details | pending |
| 3 | Client library WSClient + React integration (WSProvider, useWSEvent, usePresence, useTypingIndicator, WSStatusIndicator) — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full WebSocket Engine workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes WebSocket Engine | Success | pending |
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
