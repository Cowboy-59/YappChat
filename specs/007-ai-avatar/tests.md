# Test Plan: AI Avatar

**Spec Number**: 007
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

### UT-001 — Starter avatar library + static assets + library/current API + format-and-resize rules

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Starter avatar library + static assets + library/current API + format-and-resize rules — happy path | Success response | pending |
| 2 | Starter avatar library + static assets + library/current API + format-and-resize rules — validation error | Error with details | pending |
| 3 | Starter avatar library + static assets + library/current API + format-and-resize rules — edge case | Graceful handling | pending |

### UT-002 — avatarconfigs table + per-user + per-company selection + persona name/vibe + WS propagation

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | avatarconfigs table + per-user + per-company selection + persona name/vibe + WS propagation — happy path | Success response | pending |
| 2 | avatarconfigs table + per-user + per-company selection + persona name/vibe + WS propagation — validation error | Error with details | pending |
| 3 | avatarconfigs table + per-user + per-company selection + persona name/vibe + WS propagation — edge case | Graceful handling | pending |

### UT-003 — AvatarDisplay component + CSS animations + state machine + AvatarStateManager WS subscriber

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | AvatarDisplay component + CSS animations + state machine + AvatarStateManager WS subscriber — happy path | Success response | pending |
| 2 | AvatarDisplay component + CSS animations + state machine + AvatarStateManager WS subscriber — validation error | Error with details | pending |
| 3 | AvatarDisplay component + CSS animations + state machine + AvatarStateManager WS subscriber — edge case | Graceful handling | pending |

### UT-004 — Avatar surfaces wired across all 5 display locations (sidebar, chat header, directory, video tile, message sender)

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Avatar surfaces wired across all 5 display locations (sidebar, chat header, directory, video tile, message sender) — happy path | Success response | pending |
| 2 | Avatar surfaces wired across all 5 display locations (sidebar, chat header, directory, video tile, message sender) — validation error | Error with details | pending |
| 3 | Avatar surfaces wired across all 5 display locations (sidebar, chat header, directory, video tile, message sender) — edge case | Graceful handling | pending |

### UT-005 — Avatar import: file upload + URL import with strict SSRF defence + rate limits

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Avatar import: file upload + URL import with strict SSRF defence + rate limits — happy path | Success response | pending |
| 2 | Avatar import: file upload + URL import with strict SSRF defence + rate limits — validation error | Error with details | pending |
| 3 | Avatar import: file upload + URL import with strict SSRF defence + rate limits — edge case | Graceful handling | pending |

### UT-006 — AI photo-to-avatar style conversion + 3-attempt regen limit + shared GEN_IMAGE_DAILY_LIMIT bucket

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | AI photo-to-avatar style conversion + 3-attempt regen limit + shared GEN_IMAGE_DAILY_LIMIT bucket — happy path | Success response | pending |
| 2 | AI photo-to-avatar style conversion + 3-attempt regen limit + shared GEN_IMAGE_DAILY_LIMIT bucket — validation error | Error with details | pending |
| 3 | AI photo-to-avatar style conversion + 3-attempt regen limit + shared GEN_IMAGE_DAILY_LIMIT bucket — edge case | Graceful handling | pending |

### UT-007 — Picker frontend: AvatarPicker + AvatarPreview + AvatarImportModal + AvatarPersonaEditor

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Picker frontend: AvatarPicker + AvatarPreview + AvatarImportModal + AvatarPersonaEditor — happy path | Success response | pending |
| 2 | Picker frontend: AvatarPicker + AvatarPreview + AvatarImportModal + AvatarPersonaEditor — validation error | Error with details | pending |
| 3 | Picker frontend: AvatarPicker + AvatarPreview + AvatarImportModal + AvatarPersonaEditor — edge case | Graceful handling | pending |

### UT-008 — AI conversion frontend: AvatarConvertModal multi-step flow (upload → style → preview)

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | AI conversion frontend: AvatarConvertModal multi-step flow (upload → style → preview) — happy path | Success response | pending |
| 2 | AI conversion frontend: AvatarConvertModal multi-step flow (upload → style → preview) — validation error | Error with details | pending |
| 3 | AI conversion frontend: AvatarConvertModal multi-step flow (upload → style → preview) — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full AI Avatar workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes AI Avatar | Success | pending |
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
