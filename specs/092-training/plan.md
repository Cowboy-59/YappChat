# Plan: Training — Self-Paced Course Library

**Spec Number**: 092
**Date**: 2026-07-21
**Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

## Implementation Plan

### Phase 1: Foundation (data + access)
- T001 Data model + migration — `trainingcourses`, `trainingitems`, `trainingprogress` (generate-only; applied manually)
- T002 Space-scoped access + course CRUD API (reuse spec 017 membership guard; author-gated writes)

### Phase 2: Content (items + media)
- T003 Course items API — three item types; uploads via own `mediakey` (spec 068 S3 pattern); recording references (no copy)
- T004 Video playback reuse — spec 071 recording routes for references + a training-media signed-URL route for uploads; both play in the reused `ReplayPlayer`
- T005 Inline document viewer — reuse the space-AI PDF pipeline/viewer; download fallback

### Phase 3: Progress + UI
- T006 Per-learner progress — mark/un-mark complete; per-item + course progress in course detail
- T007 Frontend UI — `TrainingLibrary`, `CourseView`, `CourseEditor`, `DocumentViewer` + Training entry in the app shell

### Phase 4: Verification
- T008 Verification — tsc/eslint/vitest + access negative test + progress-persistence test

## Key Decisions (from scope)

- **Reuse over rebuild:** all video plays through the spec 071 `ReplayPlayer`; documents render through the existing space-AI PDF viewer. No new playback path (Success Metric 4).
- **Access follows the space** (spec 017, lowest level governs) — no per-course public links or invites in v1.
- **Authoring = any presentation host**; other members view/complete only.
- **Uploaded video** is stored under its own `mediakey` on `trainingitems`, NOT as a `presentationrecordings` row — only `recording`-type items reference `presentationrecordings`.
- **Progress is per-learner only**, private; no author-facing reporting in v1 (clean follow-on: a read view over `trainingprogress`, no schema change).
- **Courses are the only grouping unit** in v1 — no categories/tags, no quizzes/certificates.

## Migrations

- One new migration adding `trainingcourses`, `trainingitems`, `trainingprogress`. Generate SQL only via `db:generate`; apply manually via `node scripts/db-migrate.mjs` (per house rule). Watch the recurring drizzle-snapshot ledger drift — backfill the ledger if `db:generate` emits a duplicate number.

## Remaining Risks

- **Document viewer coverage:** the space-AI PDF pipeline is PDF-first; non-PDF formats (DOCX, slides) may only download rather than render inline. Confirm required formats during T005.
- **Uploaded-video serving:** the training-media signed-URL route must enforce the same space-membership check as course routes so an upload's URL can't leak to a non-member (mirrors the spec 071 recording-share access model).
