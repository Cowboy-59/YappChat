# Test Plan: Training — Self-Paced Course Library

**Spec Number**: 092
**Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

## Static checks (T008)

- `tsc --noEmit` clean
- `eslint` clean
- `vitest` green (existing suites + new tests below)

## Unit / integration tests

| ID | Covers | Assertion |
|----|--------|-----------|
| TT-01 | FR-001 | A non-member of the space gets 403 on `GET /api/training/courses/[id]`, its items, and the uploaded-video/recording share URL. |
| TT-02 | FR-001 | `GET /api/training/courses?spaceId=…` returns only courses whose space the caller belongs to. |
| TT-03 | FR-002 | Items are returned in `position` order; reordering persists and re-reads in the new order. |
| TT-04 | FR-003/005 | A `recording` item references an existing `presentationrecordings` row; deleting the item leaves the recording and its presentation intact. |
| TT-05 | FR-006 | An uploaded `video` item stores a `mediakey`, creates **no** `presentationrecordings` row, and resolves to a playable signed URL. |
| TT-06 | FR-007 | A `document` item exposes the inline-viewer payload for a PDF; an unsupported format falls back to a download URL. |
| TT-07 | FR-008 | A presentation host can create/edit/publish a course in a space they belong to; a non-host member is refused (403) on write routes. |
| TT-08 | FR-009 | `POST …/complete` marks the calling user complete (idempotent via the unique `(itemid,userid)` index); `DELETE` un-marks; another user's completion is unaffected. |
| TT-09 | FR-009 | Course-detail progress reflects only the caller's completed items and persists across a fresh session. |

## End-to-end (manual / scripted)

1. **Author flow (US1):** as a presentation host, create a course in a space → add a recording reference + an uploaded video + a PDF → order 1‑2‑3 → publish → confirm it lists for space members in order.
2. **Learner flow (US2):** as a space member, open the course → play the recording in the reused `ReplayPlayer` → mark complete → open the PDF inline → mark complete → log out/in → progress still 2/3.
3. **Access flow (US3, negative):** as a non-member, attempt the course, an item, and the media/share URL → every attempt 403.

## Success-criteria validation

- SC-1: time the author flow end-to-end (< 5 min).
- SC-2: verify 100% progress persists across logout/login.
- SC-3: negative access test passes 100% (TT-01).
- SC-4: confirm no new video player module is introduced — video items import the spec 071 `ReplayPlayer`.
