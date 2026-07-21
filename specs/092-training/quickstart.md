# Quickstart: Training — Self-Paced Course Library

**Spec Number**: 092
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Tasks**: [tasks.md](tasks.md)

## What this is

A per-space **course library**: an author (any presentation host) assembles ordered **courses** from past presentation recordings, uploaded videos, and documents; space members work through them at their own pace and mark each item complete. It reuses spec 071's `ReplayPlayer` for all video and the space-AI PDF viewer for documents — no new playback path.

## Where the code lives

- **Schema:** `apps/web/src/lib/db/training-schema.ts` (new) — `trainingcourses`, `trainingitems`, `trainingprogress`.
- **Service:** `apps/web/src/lib/training/service.ts` (new) — course/item CRUD + progress, all behind the spec 017 space-membership guard.
- **Routes:** `apps/web/src/app/api/training/**` (new) — courses, items, complete; plus a training-media signed-URL route for uploads.
- **UI:** `apps/web/src/components/training/**` (new) — `TrainingLibrary`, `CourseView`, `CourseEditor`, `DocumentViewer`; page under `apps/web/src/app/(authenticated)/training/**`.
- **Reused:** `components/presentations/ReplayPlayer.tsx`, the spec 071 `/api/presentations/[id]/recording` routes, the spec 068 S3 upload pattern, and the space-AI PDF viewer.

## Build order

1. T001 schema + migration (generate only; apply manually via `node scripts/db-migrate.mjs`).
2. T002 access + course CRUD → T003 items → T004 video reuse → T005 document viewer.
3. T006 progress → T007 UI + shell entry.
4. T008 verification (tsc/eslint/vitest + access negative test).

## Local run

Same as the rest of `apps/web`: client `next dev -p 5175`, WS `pnpm ws` (`:3011`), shared pgkanban DB. See the status-dashboard memory for current ports and DB caveats.

## Gotchas

- **Never auto-apply migrations** — generate SQL only; the user applies. Watch the recurring drizzle ledger drift.
- **Access on media URLs:** the uploaded-video signed URL and the recording share URL must both enforce space membership, or a non-member link leaks (TT-01).
- **Uploaded video ≠ presentation recording:** store a `mediakey` on the item; do not create a `presentationrecordings` row.
