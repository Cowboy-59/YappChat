# Test Plan: Personal Assistant

**Spec Number**: 002
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

### UT-001 — PA core: paconfigs + agent registration + notification bubble triggers + OpenAIChatPanel action contract

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | PA core: paconfigs + agent registration + notification bubble triggers + OpenAIChatPanel action contract — happy path | Success response | pending |
| 2 | PA core: paconfigs + agent registration + notification bubble triggers + OpenAIChatPanel action contract — validation error | Error with details | pending |
| 3 | PA core: paconfigs + agent registration + notification bubble triggers + OpenAIChatPanel action contract — edge case | Graceful handling | pending |

### UT-002 — AI provider registry + adapter layer (OpenAI-compatible / Anthropic / Ollama / Custom) + admin-only system default

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | AI provider registry + adapter layer (OpenAI-compatible / Anthropic / Ollama / Custom) + admin-only system default — happy path | Success response | pending |
| 2 | AI provider registry + adapter layer (OpenAI-compatible / Anthropic / Ollama / Custom) + admin-only system default — validation error | Error with details | pending |
| 3 | AI provider registry + adapter layer (OpenAI-compatible / Anthropic / Ollama / Custom) + admin-only system default — edge case | Graceful handling | pending |

### UT-003 — Proactive monitoring loop + panotifications + dashboard + postPANotification internal SDK + pasystemnotificationaudit

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Proactive monitoring loop + panotifications + dashboard + postPANotification internal SDK + pasystemnotificationaudit — happy path | Success response | pending |
| 2 | Proactive monitoring loop + panotifications + dashboard + postPANotification internal SDK + pasystemnotificationaudit — validation error | Error with details | pending |
| 3 | Proactive monitoring loop + panotifications + dashboard + postPANotification internal SDK + pasystemnotificationaudit — edge case | Graceful handling | pending |

### UT-004 — Calendar + Email OAuth bindings + shared OAuth callback handler + token refresh job

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Calendar + Email OAuth bindings + shared OAuth callback handler + token refresh job — happy path | Success response | pending |
| 2 | Calendar + Email OAuth bindings + shared OAuth callback handler + token refresh job — validation error | Error with details | pending |
| 3 | Calendar + Email OAuth bindings + shared OAuth callback handler + token refresh job — edge case | Graceful handling | pending |

### UT-005 — Named multi-turn AI Chat sessions backend + SSE streaming + context window mgmt + PA-driven content creation via spec 006

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Named multi-turn AI Chat sessions backend + SSE streaming + context window mgmt + PA-driven content creation via spec 006 — happy path | Success response | pending |
| 2 | Named multi-turn AI Chat sessions backend + SSE streaming + context window mgmt + PA-driven content creation via spec 006 — validation error | Error with details | pending |
| 3 | Named multi-turn AI Chat sessions backend + SSE streaming + context window mgmt + PA-driven content creation via spec 006 — edge case | Graceful handling | pending |

### UT-006 — Skill invocation runtime (FR-014) + subagent execution runtime (FR-015) + tool-use → handler HTTP call + status WSEvents

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Skill invocation runtime (FR-014) + subagent execution runtime (FR-015) + tool-use → handler HTTP call + status WSEvents — happy path | Success response | pending |
| 2 | Skill invocation runtime (FR-014) + subagent execution runtime (FR-015) + tool-use → handler HTTP call + status WSEvents — validation error | Error with details | pending |
| 3 | Skill invocation runtime (FR-014) + subagent execution runtime (FR-015) + tool-use → handler HTTP call + status WSEvents — edge case | Graceful handling | pending |

### UT-007 — Community Skills publish/browse/install/update + setup-guide library with step-by-step guidance

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Community Skills publish/browse/install/update + setup-guide library with step-by-step guidance — happy path | Success response | pending |
| 2 | Community Skills publish/browse/install/update + setup-guide library with step-by-step guidance — validation error | Error with details | pending |
| 3 | Community Skills publish/browse/install/update + setup-guide library with step-by-step guidance — edge case | Graceful handling | pending |

### UT-008 — MCP server integration: registration + tool aggregation + persistent connections + offline reconnect

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | MCP server integration: registration + tool aggregation + persistent connections + offline reconnect — happy path | Success response | pending |
| 2 | MCP server integration: registration + tool aggregation + persistent connections + offline reconnect — validation error | Error with details | pending |
| 3 | MCP server integration: registration + tool aggregation + persistent connections + offline reconnect — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Personal Assistant workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Personal Assistant | Success | pending |
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
