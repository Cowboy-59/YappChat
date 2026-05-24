# Test Plan: Agent and Skill Creation Studio

**Spec Number**: 004
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

### UT-001 — Skill CRUD + skills table + enable/disable lifecycle + auto-versioning + skillversions table + rollback

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Skill CRUD + skills table + enable/disable lifecycle + auto-versioning + skillversions table + rollback — happy path | Success response | pending |
| 2 | Skill CRUD + skills table + enable/disable lifecycle + auto-versioning + skillversions table + rollback — validation error | Error with details | pending |
| 3 | Skill CRUD + skills table + enable/disable lifecycle + auto-versioning + skillversions table + rollback — edge case | Graceful handling | pending |

### UT-002 — JSON Schema editor + skill handler test console + skilltestlogs

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | JSON Schema editor + skill handler test console + skilltestlogs — happy path | Success response | pending |
| 2 | JSON Schema editor + skill handler test console + skilltestlogs — validation error | Error with details | pending |
| 3 | JSON Schema editor + skill handler test console + skilltestlogs — edge case | Graceful handling | pending |

### UT-003 — Handler code generation (TypeScript / Python / JavaScript) + Deploy checklist

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Handler code generation (TypeScript / Python / JavaScript) + Deploy checklist — happy path | Success response | pending |
| 2 | Handler code generation (TypeScript / Python / JavaScript) + Deploy checklist — validation error | Error with details | pending |
| 3 | Handler code generation (TypeScript / Python / JavaScript) + Deploy checklist — edge case | Graceful handling | pending |

### UT-004 — Agent template CRUD + agenttemplates + agenttemplateskills + maxruntimeseconds + skill-validity guard

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Agent template CRUD + agenttemplates + agenttemplateskills + maxruntimeseconds + skill-validity guard — happy path | Success response | pending |
| 2 | Agent template CRUD + agenttemplates + agenttemplateskills + maxruntimeseconds + skill-validity guard — validation error | Error with details | pending |
| 3 | Agent template CRUD + agenttemplates + agenttemplateskills + maxruntimeseconds + skill-validity guard — edge case | Graceful handling | pending |

### UT-005 — Agent template test console + sandbox runner + agenttestlogs

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Agent template test console + sandbox runner + agenttestlogs — happy path | Success response | pending |
| 2 | Agent template test console + sandbox runner + agenttestlogs — validation error | Error with details | pending |
| 3 | Agent template test console + sandbox runner + agenttestlogs — edge case | Graceful handling | pending |

### UT-006 — Skill import/export bundles + validation preview + skill/agent metrics aggregation

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Skill import/export bundles + validation preview + skill/agent metrics aggregation — happy path | Success response | pending |
| 2 | Skill import/export bundles + validation preview + skill/agent metrics aggregation — validation error | Error with details | pending |
| 3 | Skill import/export bundles + validation preview + skill/agent metrics aggregation — edge case | Graceful handling | pending |

### UT-007 — Studio Assistant (Archie) backend: persona config + similarity search + guided chat + studioassistantconfig

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Studio Assistant (Archie) backend: persona config + similarity search + guided chat + studioassistantconfig — happy path | Success response | pending |
| 2 | Studio Assistant (Archie) backend: persona config + similarity search + guided chat + studioassistantconfig — validation error | Error with details | pending |
| 3 | Studio Assistant (Archie) backend: persona config + similarity search + guided chat + studioassistantconfig — edge case | Graceful handling | pending |

### UT-008 — Studio Assistant frontend: StudioAssistant sidebar + SimilarityMatchCard + LiveFormHighlight + SkillConfirmationCard

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Studio Assistant frontend: StudioAssistant sidebar + SimilarityMatchCard + LiveFormHighlight + SkillConfirmationCard — happy path | Success response | pending |
| 2 | Studio Assistant frontend: StudioAssistant sidebar + SimilarityMatchCard + LiveFormHighlight + SkillConfirmationCard — validation error | Error with details | pending |
| 3 | Studio Assistant frontend: StudioAssistant sidebar + SimilarityMatchCard + LiveFormHighlight + SkillConfirmationCard — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Agent and Skill Creation Studio workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Agent and Skill Creation Studio | Success | pending |
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
