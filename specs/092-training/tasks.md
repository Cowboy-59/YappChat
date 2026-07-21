# Task Breakdown: Training — Self-Paced Course Library

**Feature**: Training — Self-Paced Course Library
**Spec**: 092
**Date Generated**: 2026-07-21
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Scope**: [../Project-Scope/092-training.md](../Project-Scope/092-training.md)

---

## Tasks

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Data model + migration (trainingcourses/trainingitems/trainingprogress) | high | done |
| 2 | Space-scoped access + course CRUD API | high | done |
| 3 | Course items API (3 types + upload via mediakey) | high | done |
| 4 | Video playback reuse (recording routes + training-media route + ReplayPlayer) | high | done |
| 5 | Inline document viewer (reuse space-AI PDF pipeline) | medium | done |
| 6 | Per-learner progress (mark-as-complete) | medium | done |
| 7 | Frontend UI (TrainingLibrary/CourseView/CourseEditor/DocumentViewer) + shell entry | high | done |
| 8 | Verification | high | done (static: tsc/eslint/161 vitest green) |

> **Implemented 2026-07-21.** All 8 tasks built in `apps/web` (tsc + eslint clean, 161 vitest incl. 7 new training units). Migration `0030_training.sql` **applied** to the shared DB (hand-authored to dodge the drizzle 0019-snapshot drift). **Live e2e still pending** (2 accounts: author a mixed-media course → learner completes → non-member 403). Not git-committed.

## Task Details

### T001 — Data model + migration (trainingcourses/trainingitems/trainingprogress)

Add `trainingcourses`, `trainingitems`, `trainingprogress` tables to the `yappchat` Postgres schema via Drizzle (plural lowercase, UUID v7 `id`, FKs as `<parent>id`). `trainingitems.type` = `recording` | `video` | `document` with exactly one of `presentationrecordingid` (FK → `presentationrecordings`), `mediakey`, or `documentkey`; `trainingprogress` unique on (`itemid`, `userid`). Generate migration SQL only; applied manually per house rule. Covers the data needs of FR-001/002/003/005/006/009.

### T002 — Space-scoped access + course CRUD API

Create the training service and Next.js routes `GET/POST /api/training/courses` and `GET/PATCH/DELETE /api/training/courses/[id]`, reusing the spec 017 space-membership guard on every route (non-member → 403; members see only their spaces' courses). Course create/edit/reorder/publish/delete gated to authors (any presentation host). FR-001/002/008.

### T003 — Course items API (3 types + upload via mediakey)

Implement `POST /api/training/courses/[id]/items` and `PATCH`/`DELETE …/items/[itemId]` to add/edit/reorder/remove items of the three types: a recording reference (`presentationrecordingid`, no copy), an uploaded video (own `mediakey`, reusing the spec 068 S3 upload pattern; does NOT create a `presentationrecordings` row), or a document (`documentkey`). Deleting an item never alters the source recording. FR-003/005/006.

### T004 — Video playback reuse (recording routes + training-media route + ReplayPlayer)

Serve recording-reference items via the existing spec 071 recording routes; serve uploaded-video items via a training-media signed-URL route from their `mediakey` (enforcing the same space-membership check). Both play in the reused spec 071 `ReplayPlayer` with no new player code path. FR-004/006 + Success Metric 4.

### T005 — Inline document viewer (reuse space-AI PDF pipeline)

Render document items inline on the training page by reusing the existing space-AI PDF pipeline/viewer; formats it can't render inline fall back to download. FR-007.

### T006 — Per-learner progress (mark-as-complete)

Implement `POST/DELETE /api/training/items/[itemId]/complete` to mark/un-mark the calling learner complete, and surface per-item completion + overall course progress (e.g. 2/3) in the course-detail response. Completion is per-user and private (no author reporting); persists across sessions. FR-009.

### T007 — Frontend UI (TrainingLibrary/CourseView/CourseEditor/DocumentViewer) + shell entry

Build `TrainingLibrary` (per-space course list with progress badges), `CourseView` (ordered items, per-item completion, reused `ReplayPlayer` for video, inline `DocumentViewer` for docs), `CourseEditor` (author create/order/publish + add items), and a Training entry in the authenticated app shell / space navigation reachable in ≤2 clicks. FR-002/004/007/010.

### T008 — Verification

Verify end-to-end: `tsc --noEmit`, eslint, vitest. Add tests covering the access negative case (non-member → 403 on course/item/media/share link), per-learner progress persistence, and the three item types rendering. FR-001/009 acceptance + Success Metrics 2/3.
