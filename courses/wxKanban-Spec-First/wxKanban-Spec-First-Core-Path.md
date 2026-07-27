# wxKanban Spec-First — Core Path

**The short course.** Six modules that take a student from "I have an idea (or a legacy app)" to "I have released something a small business could pay for," with nothing in it that merely explains.

**Design rule:** every Core Path lesson is *the same recording* as its Full course lesson. Core is a strict subset. Nothing here is recorded twice, and no lesson is re-cut for the short version.

| | Track A student | Track B student | To record for Core |
|---|---|---|---|
| Modules | 6 | 6 | 7 module-units |
| Lessons | 30 | 31 | 35 |
| Video time | 4h 26m | 4h 29m | 5h 10m |

**Against the Full course:** 35 of 72 lessons. Recording the Core Path first gets a complete, shippable course into YappChat Training at roughly half the production cost, and every minute of it counts toward the Full course later.

---

## Final timings — re-baselined against the actual scripts

All 35 Core lessons are now written, and every slot below is derived from measured narration rather than estimated in advance. **This is the settled number: 4h 26m / 4h 29m, 5h 10m to record.**

**The estimate history is worth stating plainly**, because it moved twice and the middle number was wrong.

| Stage | Core Path length | Basis |
|---|---|---|
| Blueprint, pre-scripting | ~4h 30m | Estimate |
| After building out the module list | 5h 21m | Slots set at the top of each type's range |
| **After scripting all 35 lessons** | **4h 26m** | **Measured narration** |

The original estimate was close. The 5h 21m figure — and the note that called the original "optimistic" — was an artefact of setting every slot at the top of the pack's per-lesson-type ranges rather than the middle. Once real scripts existed, the numbers came back down to roughly where they started. If you budgeted production against 5h 21m, you have about an hour of slack you didn't know about.

**How each slot was derived.** Narration was measured at 130 words per minute, then divided by the share of the slot narration should occupy for that lesson type: **concept 85%**, **synthesis 80%**, **worked example 75%**, **practice 70%**, **demonstration 60%**. Demonstrations get the most headroom because a viewer genuinely spends time watching a download run, a conversion process, or an interview unfold. Concept lessons get the least, because narration *is* the lesson.

That headroom is also what makes the dubbed languages fit — see the localization plan.

---

## The selection rule

**Keep every lesson that produces an artifact. Move lessons that explain into the Full course.**

That rule, applied mechanically, is what produced the module list below. It has one deliberate exception: Lesson 1.1 is pure concept and stays, because it is the lesson that convinces a sceptical developer to keep watching. A course nobody finishes has no completion rate to defend.

---

## The Six Core Modules

Lesson numbers refer to the Full course blueprint, so `3A.2` here and `3A.2` there are the same recording. **Order within a Core module sometimes differs from the Full course** — noted where it does.

### Core Module 1 — Why Spec-First Beats "Just Ask the AI"
*4 lessons · 37 min · from Full M1*

| # | Lesson | Type | Min |
|---|---|---|---|
| 1.1 | What Goes Wrong When You Let AI Write Code First | Concept | 11 |
| 1.2 | The Spec-First Loop in One Picture | Concept | 12 |
| 1.3 | **QUICK WIN:** Write the One-Page Intent That Changes Every AI Answer | Practice | 8 |
| 1.5 | Choose Your Track: Build New or Convert a Legacy App | Synthesis | 6 |

**Cut from Core:** 1.4 (The Six Phases and the Gate Each One Enforces).
**Completion marker:** A one-page project intent and a recorded track decision.

---

### Core Module 2 — Stand Up Your wxKanban Workspace
*5 lessons · 53 min · from Full M2*

| # | Lesson | Type | Min |
|---|---|---|---|
| 2.1 | Create Your Project in wxKanban | Demonstration | 13 |
| 2.2 | Download and Unpack the Project Kit | Demonstration | 11 |
| 2.3 | Connect the Tools: MCP, Gateway, and the Dev Cockpit | Demonstration | 14 |
| 2.4 | **PRACTICE:** Prove Your Environment Is Healthy | Practice | 4 |
| 2.6 | When It Breaks: The Five Most Common Setup Failures | Worked example | 11 |

**Cut from Core:** 2.5 (Read Your Ground Rules).
**Kept deliberately:** 2.6. It is the single lesson most likely to prevent a career changer from abandoning the course in week one. Cutting it would save twelve minutes and cost students.
**Completion marker:** A green health check plus a written environment record.

---

### Core Module 3A — Get to an Approved Scope *(Track A: build new)*
*4 lessons · 41 min · from Full M3A + M4A*

| # | Lesson | Type | Min |
|---|---|---|---|
| 3A.3 | Writing Actors, Success Metrics, and Boundaries That Hold | Worked example | 10 |
| 3A.2 | Running buildscope: The Section-by-Section Interview | Demonstration | 14 |
| 4A.2 | Running validatescope and Reading the Findings | Demonstration | 11 |
| 3A.4 | **PRACTICE:** Scope Your Own Feature | Practice | 6 |

**Reordered:** 3A.3 moves ahead of 3A.2 in Core. In the Full course, 3A.1 teaches scope structure before the interview; with 3A.1 cut, 3A.3 has to carry that job, so it must come first.
**Cut from Core:** 3A.1, 3A.5, and all of M4A except 4A.2.
**Completion marker:** A scope document for the student's own feature, validated clean.

---

### Core Module 3B — Get to an Approved Scope *(Track B: convert)*
*5 lessons · 44 min · from Full M3B + M4B*

| # | Lesson | Type | Min |
|---|---|---|---|
| 3B.3 | Running the Conversion: From Source to Readable Markdown | Demonstration | 13 |
| 3B.4 | What Comes Out: Regenerated Screens, Schema, Queries, Reports | Worked example | 10 |
| 3B.5 | **PRACTICE:** Convert One Screen of Your Own App | Practice | 5 |
| 4B.2 | Running the Scope Pass: Resumable, Screen by Screen | Demonstration | 11 |
| 4B.5 | **PRACTICE:** Scope Two Screens and Validate Them | Practice | 5 |

*This is the longest of the two track modules, and correctly so — a conversion run and an analyst interview both involve real waiting on screen, which is why 3B.3 and 4B.2 keep the most generous slots in the module.*

**Cut from Core:** 3B.1, 3B.2, 3B.6, 4B.1, 4B.3, 4B.4.
**Note:** 3B.2 (Pick Your Path) is cut, so Core Module 3B opens by naming the three conversion tracks in its first ninety seconds — see the audit below.
**Completion marker:** Converted artifacts plus validated scopes for two screens.

---

### Core Module 4 — From Scope to Specs
*4 lessons · 36 min · from Full M5*

| # | Lesson | Type | Min |
|---|---|---|---|
| 5.2 | Specify and Clarify: Killing Ambiguity Before Planning | Demonstration | 13 |
| 5.3 | **PRACTICE:** Run Specify and Clarify on Your Scope | Practice | 4 |
| 5.4 | Plan: Research, Data Model, Contracts, and Quickstart | Demonstration | 10 |
| 5.5 | Tasks: Turning a Plan Into Checkable Work | Demonstration | 9 |

**Cut from Core:** 5.1, 5.6.
**Completion marker:** A complete spec folder. See the audit — this is the one Core module that does not end on a hands-on lesson.

---

### Core Module 5 — Build It
*7 lessons · 53 min · from Full M6 + M7*

| # | Lesson | Type | Min |
|---|---|---|---|
| 6.1 | The Naming Rules That Keep a Schema Legible | Concept | 6 |
| 6.2 | From Data Model to Schema Definition | Demonstration | 9 |
| 6.3 | Generating Migrations Without Blowing Up Your Data | Demonstration | 9 |
| 6.5 | **PRACTICE:** Model, Generate, Dry-Run | Practice | 5 |
| 7.2 | Working Task by Task, Not Feature by Feature | Demonstration | 10 |
| 7.5 | Git Discipline the Kit Expects | Demonstration | 9 |
| 7.3 | **PRACTICE:** Implement Your First Three Tasks | Practice | 5 |

**Reordered:** 7.5 moves ahead of 7.3 in Core, so the module closes on hands-on work rather than a demonstration.
**Cut from Core:** 6.4, 7.1, 7.4, 7.6.
**Completion marker:** A migration, a clean dry-run push, and three committed tasks.

---

### Core Module 6 — Ship It
*6 lessons · 46 min · from Full M8 + M10*

| # | Lesson | Type | Min |
|---|---|---|---|
| 8.2 | Building the Test Plan From the Spec | Demonstration | 10 |
| 8.3 | Running QA and Recording Results | Demonstration | 9 |
| 8.6 | **PRACTICE:** Take One Spec Through the QA Gate | Practice | 3 |
| 10.3 | Deploying the Build | Demonstration | 9 |
| 10.5 | Finalizing the Release and the Release Record | Demonstration | 8 |
| 10.6 | **PRACTICE:** Cut Your First Release | Practice | 7 |

**Cut from Core:** all of M9 (human testing), plus 8.1, 8.4, 8.5, 10.1, 10.2, 10.4.
**Completion marker:** A deployed application with a completed release record.

---

## Sequence Audit — What the Cuts Break, and the Fixes

Cutting 37 lessons out of a sequenced course creates dangling references. Seven were found. Each fix below is content added to a **retained** lesson, which means it also appears in the Full course — a small amount of redundancy in Full, in exchange for a Core Path that stands on its own.

| # | What breaks | Fix |
|---|---|---|
| 1 | **The six phases are never taught.** 1.4 is cut, but Core Modules 4, 5, and 6 all refer to phases and gates. | Lesson **1.2** gains a 60-second phase map at the end — the six phases named, one line each. The full treatment stays in 1.4 for the Full course. |
| 2 | **The rules files are never introduced.** 2.5 is cut, so students never learn that `CLAUDE.md` and the rules directory are what constrain the AI. | Lesson **2.4's** practice step gains a final instruction: open `CLAUDE.md`, read your project's rules, and note two of them in your environment record. |
| 3 | **Scope structure is assumed.** 3A.1 is cut, but 3A.2 demonstrates an interview that fills in a structure the student has never seen. | Handled by **reordering** — 3A.3 now runs first and carries the structure. No new content needed. |
| 4 | **Track B students don't know which converter to run.** 3B.2 is cut. | Lesson **3B.3** opens by naming all three conversion paths and their required inputs in ninety seconds, then proceeds with the student's own. |
| 5 | **The spec pipeline's output map is never shown.** 5.1 is cut, so 5.2 starts generating artifacts the student can't name. | Lesson **5.2** opens with a 90-second artifact map: what each file in a spec folder is for. |
| 6 | **Specs never reach the wxKanban board.** 6.4 (dbpush) is cut, so the student's board stays empty while their local folder fills up. | Lesson **6.5's** practice gains a final step: run the dry-run push, confirm zero errors. The explanation of what it does stays in 6.4. |
| 7 | **`implement` is used before it's framed.** 7.1 and 7.4 are both cut. | Lesson **7.2** opens by stating the boundary — what the orchestrator decides and what you decide — in about a minute. |

### Two flags left standing

**Core Module 4 ends on a demonstration, not a hands-on lesson.** Every other Core module closes with the student producing something. Module 4 closes on 5.5 (Tasks), because the alternative — moving 5.3's practice to the end — would make it a practice lesson for content taught two lessons later. The mitigation is that 5.5 already ends by having the student decompose *their own* plan, so the artifact exists even though the lesson type says demonstration. Accepted rather than fixed.

**Human testing is absent from the Core Path entirely.** All of Module 9 is cut. A student can complete the Core Path, release an application, and never have had another human touch it. This is the most defensible cut on production grounds and the least defensible on quality grounds. **Recommendation:** the Core Path's closing lesson (10.6) should end by naming this gap explicitly — "you have shipped, and you have not yet had a single real user test this; that is Module 9 of the full course, and it is the next thing you should do." An honest handoff converts the gap into the reason to continue.

---

## What This Means for Production

**Record in this order:**

1. **The 35 Core lessons** (5h 10m) → publish the Core Path in YappChat Training. You have a complete, shippable course.
2. **The remaining 37 lessons** (6h 30m) → publish the Full course, drawing on all 72 recordings.

**Two courses, one library.** Under spec 092 a course is an ordered sequence of training items, and nothing stops the same recording being item 3 of one course and item 7 of another. Core and Full can both live in the same space, sharing every recording, with no duplication in storage and no re-cutting.

**Sequence the recording by module, not by course.** Record Core Module 2 in one sitting — 2.1, 2.2, 2.3, 2.4, 2.6 — while the environment is in the right state, rather than jumping between courses. Lesson 2.3 should be recorded twice, once per operating system, as flagged in the blueprint.

---

*Generated by the curriculum-architect skill. Companion to `wxKanban-Spec-First-Curriculum-Blueprint.md`.*
