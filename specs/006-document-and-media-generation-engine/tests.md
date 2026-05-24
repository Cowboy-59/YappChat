# Test Plan: Document and Media Generation Engine

**Spec Number**: 006
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

### UT-001 — Async job queue infrastructure + S3-compatible file storage with signed-URL downloads + TTL expiry

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Async job queue infrastructure + S3-compatible file storage with signed-URL downloads + TTL expiry — happy path | Success response | pending |
| 2 | Async job queue infrastructure + S3-compatible file storage with signed-URL downloads + TTL expiry — validation error | Error with details | pending |
| 3 | Async job queue infrastructure + S3-compatible file storage with signed-URL downloads + TTL expiry — edge case | Graceful handling | pending |

### UT-002 — PDF generation via @react-pdf/renderer + system templates (report-standard / invoice-basic / summary-onecolumn)

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | PDF generation via @react-pdf/renderer + system templates (report-standard / invoice-basic / summary-onecolumn) — happy path | Success response | pending |
| 2 | PDF generation via @react-pdf/renderer + system templates (report-standard / invoice-basic / summary-onecolumn) — validation error | Error with details | pending |
| 3 | PDF generation via @react-pdf/renderer + system templates (report-standard / invoice-basic / summary-onecolumn) — edge case | Graceful handling | pending |

### UT-003 — Excel generation via exceljs + system templates (data-export-standard / financial-summary)

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Excel generation via exceljs + system templates (data-export-standard / financial-summary) — happy path | Success response | pending |
| 2 | Excel generation via exceljs + system templates (data-export-standard / financial-summary) — validation error | Error with details | pending |
| 3 | Excel generation via exceljs + system templates (data-export-standard / financial-summary) — edge case | Graceful handling | pending |

### UT-004 — PowerPoint generation via pptxgenjs + system templates (pitch-deck / status-update / technical-report)

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | PowerPoint generation via pptxgenjs + system templates (pitch-deck / status-update / technical-report) — happy path | Success response | pending |
| 2 | PowerPoint generation via pptxgenjs + system templates (pitch-deck / status-update / technical-report) — validation error | Error with details | pending |
| 3 | PowerPoint generation via pptxgenjs + system templates (pitch-deck / status-update / technical-report) — edge case | Graceful handling | pending |

### UT-005 — AI image text-to-image generation (FR-004): provider abstraction + DALL-E 3 default + shared daily limit

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | AI image text-to-image generation (FR-004): provider abstraction + DALL-E 3 default + shared daily limit — happy path | Success response | pending |
| 2 | AI image text-to-image generation (FR-004): provider abstraction + DALL-E 3 default + shared daily limit — validation error | Error with details | pending |
| 3 | AI image text-to-image generation (FR-004): provider abstraction + DALL-E 3 default + shared daily limit — edge case | Graceful handling | pending |

### UT-006 — AI image edit / image-to-image (FR-009): multipart endpoint + provider capability check + transparent backgrounds + spec 007 integration

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | AI image edit / image-to-image (FR-009): multipart endpoint + provider capability check + transparent backgrounds + spec 007 integration — happy path | Success response | pending |
| 2 | AI image edit / image-to-image (FR-009): multipart endpoint + provider capability check + transparent backgrounds + spec 007 integration — validation error | Error with details | pending |
| 3 | AI image edit / image-to-image (FR-009): multipart endpoint + provider capability check + transparent backgrounds + spec 007 integration — edge case | Graceful handling | pending |

### UT-007 — Document template management (FR-007) + generation log (FR-008) + admin-only template CRUD

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Document template management (FR-007) + generation log (FR-008) + admin-only template CRUD — happy path | Success response | pending |
| 2 | Document template management (FR-007) + generation log (FR-008) + admin-only template CRUD — validation error | Error with details | pending |
| 3 | Document template management (FR-007) + generation log (FR-008) + admin-only template CRUD — edge case | Graceful handling | pending |

### UT-008 — Frontend: GeneratedFileCard / GenerationProgressCard / GeneratedImageCard + GenTemplateManager admin UI

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Frontend: GeneratedFileCard / GenerationProgressCard / GeneratedImageCard + GenTemplateManager admin UI — happy path | Success response | pending |
| 2 | Frontend: GeneratedFileCard / GenerationProgressCard / GeneratedImageCard + GenTemplateManager admin UI — validation error | Error with details | pending |
| 3 | Frontend: GeneratedFileCard / GenerationProgressCard / GeneratedImageCard + GenTemplateManager admin UI — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Document and Media Generation Engine workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Document and Media Generation Engine | Success | pending |
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
