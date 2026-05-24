# Test Plan: Public Landing Page

**Spec Number**: 012
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

### UT-001 — Static-render page scaffolding + responsive layout + dark/light theming

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Static-render page scaffolding + responsive layout + dark/light theming — happy path | Success response | pending |
| 2 | Static-render page scaffolding + responsive layout + dark/light theming — validation error | Error with details | pending |
| 3 | Static-render page scaffolding + responsive layout + dark/light theming — edge case | Graceful handling | pending |

### UT-002 — Hero, Features (seven pillars), and Security callout sections

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Hero, Features (seven pillars), and Security callout sections — happy path | Success response | pending |
| 2 | Hero, Features (seven pillars), and Security callout sections — validation error | Error with details | pending |
| 3 | Hero, Features (seven pillars), and Security callout sections — edge case | Graceful handling | pending |

### UT-003 — PricingSection with plan-aware signup CTA routing

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | PricingSection with plan-aware signup CTA routing — happy path | Success response | pending |
| 2 | PricingSection with plan-aware signup CTA routing — validation error | Error with details | pending |
| 3 | PricingSection with plan-aware signup CTA routing — edge case | Graceful handling | pending |

### UT-004 — `landingpageconfig` table + public/admin config APIs + Zod validation

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | `landingpageconfig` table + public/admin config APIs + Zod validation — happy path | Success response | pending |
| 2 | `landingpageconfig` table + public/admin config APIs + Zod validation — validation error | Error with details | pending |
| 3 | `landingpageconfig` table + public/admin config APIs + Zod validation — edge case | Graceful handling | pending |

### UT-005 — SEO: metadata, OG/Twitter tags, JSON-LD, sitemap.xml, robots.txt

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | SEO: metadata, OG/Twitter tags, JSON-LD, sitemap.xml, robots.txt — happy path | Success response | pending |
| 2 | SEO: metadata, OG/Twitter tags, JSON-LD, sitemap.xml, robots.txt — validation error | Error with details | pending |
| 3 | SEO: metadata, OG/Twitter tags, JSON-LD, sitemap.xml, robots.txt — edge case | Graceful handling | pending |

### UT-006 — FAQ accordion, Testimonials, Footer, AppsDownloadModal

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | FAQ accordion, Testimonials, Footer, AppsDownloadModal — happy path | Success response | pending |
| 2 | FAQ accordion, Testimonials, Footer, AppsDownloadModal — validation error | Error with details | pending |
| 3 | FAQ accordion, Testimonials, Footer, AppsDownloadModal — edge case | Graceful handling | pending |

### UT-007 — Authenticated-user role-aware redirect + return-URL allow-list

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Authenticated-user role-aware redirect + return-URL allow-list — happy path | Success response | pending |
| 2 | Authenticated-user role-aware redirect + return-URL allow-list — validation error | Error with details | pending |
| 3 | Authenticated-user role-aware redirect + return-URL allow-list — edge case | Graceful handling | pending |

### UT-008 — Analytics event hooks via window.dataLayer (no bundled third-party trackers)

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Analytics event hooks via window.dataLayer (no bundled third-party trackers) — happy path | Success response | pending |
| 2 | Analytics event hooks via window.dataLayer (no bundled third-party trackers) — validation error | Error with details | pending |
| 3 | Analytics event hooks via window.dataLayer (no bundled third-party trackers) — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full Public Landing Page workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes Public Landing Page | Success | pending |
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
