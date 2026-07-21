# Spec 092: Training — Self-Paced Course Library

**Spec Number**: 092
**Status**: `planned`
**Created**: 2026-07-21
**Depends On**: 071 (Presentations — recordings + replay player), 017 (Communities/Spaces — access scope), 068 (storage/upload), 011 (auth), 001 (chat, indirectly via space conversations)
**Source**: `specs/Project-Scope/092-training.md`

## Overview

A **Training** area gives members a curated, self-paced place to learn. An author assembles **courses** — ordered sequences of training items — scoped to a community **space**; members of that space work through them at their own pace, watching videos in the **existing presentation replay player**, reading documents inline, and marking each item complete as they go. Training reuses spec 071's recording storage and replay player rather than introducing new video infrastructure — its job is to turn one-off presentation recordings, purpose-made training videos, and documents into an ordered, trackable curriculum.

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | Learner — a signed-in member of a space, working through a course at their own pace. |
| **Secondary Actors** | Author — any user who can host a presentation, assembling courses in spaces they belong to; the owning Community/Space (spec 017, access scope); recording storage (S3, spec 068); the spec 071 replay player + recording routes. |
| **Key Value** | Live presentations happen once and the recording is buried inside the presentation that produced it — there is nowhere to *go and learn*. Training collects past recordings + uploaded videos + documents into an ordered, per-learner-trackable curriculum, entirely inside YappChat, without building any new video-playback path. |

## Business Problem

Today a new or existing member has no on-demand place to learn how YappChat and its products work. Live presentations (spec 071) run once; the recording lives inside the presentation that produced it, discoverable only by someone who knows that presentation exists. Training videos made specifically for onboarding, and reference documents, have nowhere to live at all. The result: knowledge is trapped in one-off events, onboarding is ad-hoc and repetitive, and there is no way for a member to work through material in a sensible order or to see what they have and haven't covered. It is prioritized now because the recording storage, replay player, and space-access model already exist to host this natively — Training is an assembly layer on top of them, not new infrastructure.

## Actors

- Primary: Learner — a signed-in member of a space who browses and completes courses.
- Secondary: Author (any user entitled to host a presentation, editing courses in spaces they belong to), the owning Community/Space (spec 017, governs access), recording/media storage (S3, spec 068), and the spec 071 replay player + `/recording` routes.

## Success Metrics

1. An author publishes a 3-item mixed-media course (a past recording + an uploaded video + a PDF) in under 5 minutes.
2. A learner completes a course and their 100% progress persists across logout/login.
3. A non-member of the space is denied access to every training item and its recording share link, 100% of the time (verified negative test).
4. Zero new video-playback code paths — every training video plays through the existing spec 071 replay player.

## Scope Boundary

In scope: a Training area, scoped per community **space**, containing **courses** (ordered sequences of items); three item types — a reference to a **past presentation recording**, a **newly uploaded training video**, and a **document**; authoring by any presentation host in spaces they belong to; reuse of the spec 071 replay player for all video items; **in-browser** document viewing; and **per-learner mark-as-complete** progress. Builds on spec 071 (recordings + replay), spec 017 (spaces + access), spec 068 (storage/upload), and spec 011 (auth).

## Out of Scope

Author-facing completion **reporting / dashboards** (who completed what); quizzes, assessments, or scored evaluations; certificates or credentials; org-wide (non-space) training libraries; auto-enrolment or assignment; categories/tags/free-text grouping (a **course** is the only grouping unit in v1); editing of recorded/uploaded video; live/interactive training sessions (that is spec 071); and payments/paywalled courses.

## Open Questions

- **Uploaded-video storage/playback path** — RESOLVED (2026-07-21): a standalone upload is stored under its own `mediakey` (S3) on `trainingitems` and served through a training-media route; it does **not** create a `presentationrecordings` row. Only `recording`-type items reference `presentationrecordings`. This avoids overloading presentation semantics.
- **Document viewer** — RESOLVED (2026-07-21): reuse the existing **space-AI PDF pipeline/viewer** for inline document rendering rather than building a new embed. Non-PDF formats (DOCX etc.) follow whatever that pipeline already supports; anything it can't render inline falls back to download.

## User Scenarios & Testing

### US1 — Author assembles a mixed-media course (happy path)

**Actor**: Author (presentation host)

**Scenario**:

1. The author opens Training in the "Acme Onboarding" space and creates a course "New-Member Onboarding".
2. They add item 1 = a **past presentation's recording** (picked from a list of presentations they can access — not re-uploaded), item 2 = a newly **uploaded** walkthrough video, item 3 = a **PDF** handbook.
3. They order the items 1‑2‑3 and publish the course.

**Expected outcome**: The course appears in that space's Training for its members, in the author's chosen order; the recording item references the existing recording without copying it.

### US2 — Learner completes a course (happy path)

**Actor**: Learner (space member)

**Scenario**:

1. A member of the space opens "New-Member Onboarding".
2. They play item 1 in the **reused spec 071 replay player**, then mark it complete.
3. They open item 3's PDF, which renders **inline** on the training page, and mark it complete.
4. They log out and back in later; the course still shows 2/3 complete and resumes where they left off.

**Expected outcome**: Per-item completion is saved per-user, is visible only to that learner, and persists across sessions.

### US3 — Access is space-scoped (edge / negative)

**Actor**: Non-member + Learner

**Scenario**:

1. A user who is **not a member** of the space is given a direct link to a course or a training item.
2. They attempt to open the course, the item, and the underlying recording share link.

**Expected outcome**: Every attempt is denied (403); no course, item, video, document, or recording share link is exposed to a non-member. Access follows space membership (lowest level governs, per the existing space-access model).

## Functional Requirements

### Library & access

- **FR-001 — Space-scoped training.** Every course belongs to exactly one space; visibility and access follow that space's membership.
  - [ ] A non-member receives 403 on the course, its items, and their media/share links.
  - [ ] A member sees only the courses of spaces they belong to.
- **FR-010 — Training entry in the app shell.** A Training destination is reachable from the authenticated shell / space navigation.
  - [ ] Training is reachable in ≤2 clicks from the dashboard for a space member.

### Courses & items

- **FR-002 — Courses as ordered tracks.** A course is an ordered list of items (module 1, 2, 3…).
  - [ ] An author sets and reorders item positions; a learner sees the items in that order.
- **FR-003 — Three item types.** An item is exactly one of: (a) a reference to a **past presentation recording**, (b) an **uploaded training video**, or (c) a **document**.
  - [ ] Each type renders correctly within the course in the learner view.
- **FR-005 — Add a past recording without re-upload.** The author picks from presentations they can access; the item references `presentationrecordings`, not a copy.
  - [ ] Deleting a training item never deletes or alters the source recording or its presentation.
- **FR-006 — Upload a standalone training video.** The author uploads a video that was never presented live.
  - [ ] The upload is stored under its own `mediakey` and plays in the replay player identically to a recording reference.

### Playback & viewing

- **FR-004 — Reuse the replay player.** Both video item types (recording references and uploads) play in the existing spec 071 replay player page/component.
  - [ ] No new video player is built; the same component/route serves training videos.
- **FR-007 — In-browser document viewing.** Document items (PDF/doc/slides) render inline on the training page, reusing the space-AI PDF viewer; download is optional.
  - [ ] A PDF opens and is readable without leaving the app.

### Authoring & progress

- **FR-008 — Authoring by any presentation host.** Any user entitled to host a presentation can create, edit, and publish courses in spaces they belong to; other members can view but not author.
  - [ ] A non-host member can open and complete courses but cannot create or edit them.
- **FR-009 — Mark-as-complete per user.** A learner marks each item done and sees their own per-item completion and overall course progress.
  - [ ] Completion is stored per-user and is private (no author-facing reporting in v1).
  - [ ] Course progress (e.g. 2/3) reflects the learner's own completed items and persists across sessions.

## Data Requirements

New tables in the `yappchat` PostgreSQL schema (kit naming: plural, lowercase, no camelCase; UUID v7 `id`; FKs as `<parent>id`). Reuses spec 071 `presentationrecordings` for recording references, spec 068 storage for uploads/documents, and the spec 017 space-access model.

- **`trainingcourses`** — `id`, `spaceid` → `spaces.id` (cascade), `title`, `description`, `createdby` → `users.id` (FK-less, per house convention), `published` (bool), `position` (int, order within the space), `createdat`, `updatedat`.
- **`trainingitems`** — `id`, `courseid` → `trainingcourses.id` (cascade), `position` (int, order within the course), `type` (`recording` | `video` | `document`), `title`, and exactly one of: `presentationrecordingid` → `presentationrecordings.id` (for `recording`), `mediakey` (S3 key, for an uploaded `video`), or `documentkey` (S3 key, for a `document`).
- **`trainingprogress`** — `id`, `itemid` → `trainingitems.id` (cascade), `userid` → `users.id` (FK-less), `completedat`; unique on (`itemid`, `userid`).

Explicitly **not** introduced: any reporting/rollup tables, quiz/assessment tables, certificate tables, or enrolment/assignment tables (all out of scope).

## API Routes

Next.js 16 route handlers under `apps/web/src/app/api`. Access checks reuse the spec 017 space-membership guard on every route.

- `GET /api/training/courses?spaceId=…` — list published courses for a space (access-filtered).
- `POST /api/training/courses` — create a course (author only).
- `GET /api/training/courses/[id]` — course detail + ordered items + the learner's own progress.
- `PATCH /api/training/courses/[id]` — edit / reorder / publish; `DELETE` — remove (author only).
- `POST /api/training/courses/[id]/items` — add an item (recording reference, uploaded video, or document); `PATCH`/`DELETE …/items/[itemId]` — edit/reorder/remove.
- `POST /api/training/items/[itemId]/complete` — mark the calling learner complete; `DELETE` — un-mark.
- Recording-reference items reuse the spec 071 recording routes (`GET /api/presentations/[id]/recording` and `…/recording/share`). Uploaded-video items are served from their own `mediakey` (S3) via a training-media route/signed URL, played through the same `ReplayPlayer` — uploads do **not** create `presentationrecordings` rows.

## Frontend Components

React 19 + Tailwind, reusing the spec 068 S3 upload pattern (uploads/documents) and the spec 071 `ReplayPlayer` for video.

- **`TrainingLibrary`** — the per-space list of courses with progress badges.
- **`CourseView`** — ordered item list with per-item completion state and overall progress; renders the reused `ReplayPlayer` for video items and an inline document viewer for documents.
- **`CourseEditor`** — author surface to create/order/publish a course and add items (pick a recording, upload a video, or attach a document).
- **`DocumentViewer`** — inline PDF/doc viewer on the training page, **reusing the existing space-AI PDF pipeline/viewer**; formats it can't render inline fall back to download.

## Constraints & Notes

- Built directly on spec 071 (Presentations — recordings + `ReplayPlayer`) and spec 017 (Communities/Spaces — access). Training adds no new media/playback path; it references or stores media and always plays it through the spec 071 player.
- Document inline-viewing reuses the space-AI PDF indexing/viewing pipeline already in the repo.
- **v1 progress is per-learner only, no author reporting** (deliberate — see Out of Scope). Adding "who completed what" is a clean follow-on FR: it needs only a read view over `trainingprogress`, no schema change.
- Access always follows the space (lowest level governs); there is no per-course public link or invite in v1 (unlike spec 071 presentations, which can be public).
