# wxKanban Spec-First — Curriculum Blueprint

**Course:** How to run a whole project through wxKanban's spec-first orchestrator, from scoping to release
**Brand:** wxPerts, featuring wxKanban · www.wxKanban.com
**Format:** Self-paced video, hosted in YappChat Training · **Level:** Mixed · **Price:** Free
**Structure:** Two parallel tracks — Track A (build new) and Track B (convert a legacy app)

| | Track A student | Track B student | Total to record |
|---|---|---|---|
| Modules | 11 | 11 | 13 |
| Lessons | 61 | 62 | 72 |
| Video time | 9h 50m | 9h 59m | 11h 40m |

---

## 1. Learning Arc Narrative

The student arrives able to ask an AI for code and get *something back* — a file that runs, a screen that renders, and no idea whether any of it is right, complete, or safe to sell. They leave having taken one real application all the way from an idea (or a legacy WINDEV/WEBDEV, VB6, or Clarion app) to a released version a small business could pay for, with every decision written down before it was built.

They move through four turning points.

**The first shift is from *prompting* to *specifying*.** Right now the student's mental model is conversational: describe what you want, read what comes back, correct it. That model collapses the moment a project outgrows one conversation, because nothing that was decided survives. Module 1 replaces it with a written artifact chain — scope constrains spec, spec constrains task, task constrains code — and the student feels the difference in Module 1's quick win, when the same AI gives a visibly better answer to a one-page intent than it gave to a paragraph.

**The second shift is from *a chat window* to *a governed workspace*.** Module 2 stands up a real wxKanban project: a hosted board, a downloaded kit, an MCP connection, a rules directory, and a health check that either goes green or tells you why not. The student stops working in a place where the AI is unconstrained and starts working in one where the rules are files on disk.

**The third shift is from *an idea* to *approved scope*, and this is where the two tracks diverge.** Track A students (new build) learn to run the `buildscope` interview and then attack their own scope with `validatescope` and `analyzescope` until the holes are closed. Track B students (conversion) learn that legacy source is never fed to an AI directly — it is extracted first, through `wxConversion` / `vbConversion` / `cwConversion`, into readable Markdown, regenerated screens, and a reconstructed data model, and only then turned into scope documents with a gap-analysis pass that surfaces everything twenty-year-old code never wrote down. The tracks converge again at the moment both students hold the same artifact: an approved scope.

**The fourth shift is from *building* to *shipping under gates*.** Modules 5 through 10 walk the six phases in order — specs, data model, implementation, QA, human testing, beta and release — and each one teaches the same underlying discipline from a different angle: the gate is not bureaucracy, it is the thing that catches the drift you cannot see. The capstone in Module 11 hands the whole loop back to the student on a project of their own choosing, and closes by teaching them to grade themselves against the six gates without anyone watching.

---

## 2. Module Summaries

### Part 1 — Foundations *(both tracks)*

#### Module 1: Why Spec-First Beats "Just Ask the AI"
**Module outcome:** By the end of this module, the student will be able to explain why unspecified AI-assisted development fails, and will have written the one-page project intent that every later artifact grows from.
**Completion marker:** A written one-page project intent, plus a recorded decision on which track they are taking.
**Lessons:** 5 · **Time:** 49 min
**Contains the Quick Win** (Lesson 1.3, beginning at ~21 minutes into the course).

#### Module 2: Stand Up Your wxKanban Workspace
**Module outcome:** By the end of this module, the student will be able to create a wxKanban project, install and connect the kit, and verify every service is healthy.
**Completion marker:** A green `kit:health` report plus a one-page written record of their environment (project ID, kit version, gateway port, MCP endpoint).
**Lessons:** 6 · **Time:** 63 min

---

### Part 2 — Track A *(build something new)*

#### Module 3A: Turn Your Idea Into a Scope the AI Can't Misread
**Module outcome:** By the end of this module, the student will be able to produce a complete Scope-of-Project document for their own idea, with actors, success metrics, and an explicit scope boundary.
**Completion marker:** A finished scope document saved under `specs/Project-Scope/`.
**Lessons:** 5 · **Time:** 51 min

#### Module 4A: Pressure-Test the Scope Before It Becomes Code
**Module outcome:** By the end of this module, the student will be able to find and close ambiguity, contradictions, and missing decisions in their own scope before a single line of code exists.
**Completion marker:** A clean `validatescope` run with every finding either fixed or explicitly accepted in writing.
**Lessons:** 5 · **Time:** 50 min

---

### Part 2 — Track B *(convert a legacy app)*

#### Module 3B: Extract Your Legacy App Into Something an AI Can Read
**Module outcome:** By the end of this module, the student will be able to convert their legacy application's source or technical documentation into readable Markdown artifacts, regenerated screens, and a reconstructed data model.
**Completion marker:** A populated `pre-convert/` folder containing at least one fully converted screen and the extracted schema.
**Lessons:** 6 · **Time:** 61 min

#### Module 4B: Turn Legacy Artifacts Into Approved Scopes
**Module outcome:** By the end of this module, the student will be able to generate one scope document per screen plus the Program, Database, and Backend scopes, and to identify the behaviour the legacy app never documented.
**Completion marker:** A set of scope documents for at least two screens, plus a completed gap-analysis list of undocumented behaviour.
**Lessons:** 5 · **Time:** 49 min

---

### Part 3 — The Shared Build *(both tracks converge)*

#### Module 5: From Scope to Specs — The createspecs Pipeline
**Module outcome:** By the end of this module, the student will be able to take an approved scope through specify, clarify, plan, and tasks, producing a complete spec folder.
**Completion marker:** One complete `specs/NNN-name/` folder containing `spec.md`, `checklists/requirements.md`, `plan.md`, and `tasks.md`.
**Lessons:** 6 · **Time:** 57 min

#### Module 6: Model Your Data Before You Write Code
**Module outcome:** By the end of this module, the student will be able to design a schema that obeys the project's naming rules, generate migrations safely, and sync project artifacts to wxKanban.
**Completion marker:** A generated migration file plus a `dbpush --dry-run` that reports zero errors.
**Lessons:** 5 · **Time:** 41 min

#### Module 7: Implementation Without Drift
**Module outcome:** By the end of this module, the student will be able to implement a spec task by task, recognise when the AI is going off-spec, and stop to update the spec instead of letting the code diverge.
**Completion marker:** At least three completed tasks checked off against a real spec, committed on a spec branch.
**Lessons:** 6 · **Time:** 57 min

#### Module 8: Prove It Works — QA Testing
**Module outcome:** By the end of this module, the student will be able to build a requirement-traceable test plan from a spec, execute it, record results, and run a compliance audit pass.
**Completion marker:** One spec taken fully through the QA gate with results recorded, plus a filed audit report.
**Lessons:** 6 · **Time:** 56 min

#### Module 9: Human Testing and the Feedback Loop
**Module outcome:** By the end of this module, the student will be able to run a human test round and triage every piece of feedback into the right artifact — a bug, a change request, or a new spec.
**Completion marker:** At least one piece of tester feedback triaged and converted into a tracked task or new spec.
**Lessons:** 5 · **Time:** 50 min

#### Module 10: Beta, Release, and Handing It to a Customer
**Module outcome:** By the end of this module, the student will be able to prepare a beta, deploy a build, and finalize a release with a complete release record.
**Completion marker:** A deployed beta and a completed release record for the student's own application.
**Lessons:** 6 · **Time:** 53 min

#### Module 11: Capstone — Run a Whole Project Yourself
**Module outcome:** By the end of this module, the student will be able to run a small application through all six phases unaided, and to evaluate their own project against each gate.
**Completion marker:** A small finished application taken to release, plus a self-graded scorecard against the six gates and a written commitment to the next project.
**Lessons:** 6 · **Time:** 63 min

---

## 3. Full Curriculum Table

### Part 1 — Foundations (both tracks)

| Module | # | Lesson title | Learning objective | Type | Min |
|---|---|---|---|---|---|
| M1 | 1.1 | What Goes Wrong When You Let AI Write Code First | Describe the three failure modes of unspecified AI-assisted development: lost context, silent drift, and work nobody can verify. | Concept | 11 |
| M1 | 1.2 | The Spec-First Loop in One Picture | Explain how each artifact in the chain — scope, spec, task, code, test, release — constrains the one after it. | Concept | 12 |
| M1 | 1.3 | **QUICK WIN:** Write the One-Page Intent That Changes Every AI Answer | Produce a one-page project intent and compare the AI's response to it against its response to an unstructured request. | Practice | 8 |
| M1 | 1.4 | The Six Phases and the Gate Each One Enforces | Identify the six lifecycle phases and state the specific failure each phase gate is designed to catch. | Concept | 12 |
| M1 | 1.5 | Choose Your Track: Build New or Convert a Legacy App | Evaluate your own starting point and record a decision on which track to follow for the rest of the course. | Synthesis | 6 |
| M2 | 2.1 | Create Your Project in wxKanban | Create a wxKanban project and capture its stack and style profile at creation time. | Demonstration | 13 |
| M2 | 2.2 | Download and Unpack the Project Kit | Install the downloaded kit into a local folder and describe what each generated directory is responsible for. | Demonstration | 11 |
| M2 | 2.3 | Connect the Tools: MCP, Gateway, and the Dev Cockpit | Configure the hosted MCP connection, start the orchestrator gateway, and confirm the Dev Cockpit is attached. | Demonstration | 14 |
| M2 | 2.4 | **PRACTICE:** Prove Your Environment Is Healthy | Run the health check and diagnose any service that reports as unhealthy. | Practice | 4 |
| M2 | 2.5 | Read Your Ground Rules: CLAUDE.md and the Rules Directory | Explain how `CLAUDE.md` and the rules files constrain what the AI is permitted to do in your project. | Concept | 10 |
| M2 | 2.6 | When It Breaks: The Five Most Common Setup Failures | Diagnose the five classic setup failures — placeholder token in the MCP config, a proxy blocking the connection, a missing database client, the wrong project selected, and an extension version conflict — and record your environment details. | Worked example | 11 |

### Part 2 — Track A: Build Something New

| Module | # | Lesson title | Learning objective | Type | Min |
|---|---|---|---|---|---|
| M3A | 3A.1 | What a Scope Document Must Contain | Identify every required section of a Scope-of-Project document and state what each one prevents downstream. | Concept | 11 |
| M3A | 3A.2 | Running buildscope: The Section-by-Section Interview | Execute a complete `buildscope` interview, answering each section in turn rather than dumping the whole idea at once. | Demonstration | 14 |
| M3A | 3A.3 | Writing Actors, Success Metrics, and Boundaries That Hold | Construct actor lists, measurable success metrics, and an explicit in-scope/out-of-scope boundary in the exact format the tooling expects. | Worked example | 10 |
| M3A | 3A.4 | **PRACTICE:** Scope Your Own Feature | Produce a complete scope document for one feature of your own project. | Practice | 6 |
| M3A | 3A.5 | Naming, Numbering, and Dependencies Between Scopes | Apply the numbering convention and declare dependencies between scopes so build order is derivable. | Concept | 10 |
| M4A | 4A.1 | Why Bad Scopes Are Cheap to Fix and Expensive to Ship | Justify spending an extra hour on scope by tracing the cost of the same defect found at scope, at implementation, and after release. | Concept | 9 |
| M4A | 4A.2 | Running validatescope and Reading the Findings | Execute `validatescope` and interpret each finding as either a real gap or an accepted trade-off. | Demonstration | 11 |
| M4A | 4A.3 | analyzescope: Finding Holes, Ambiguity, and Contradictions | Analyze a scope document for internal contradictions and unstated assumptions using the audit pass. | Demonstration | 12 |
| M4A | 4A.4 | **PRACTICE:** Fix Every Finding in Your Own Scope | Revise your own scope until validation reports clean, documenting anything you deliberately accept. | Practice | 6 |
| M4A | 4A.5 | Cross-Scope Conflicts and the Big-Picture Flow Map | Integrate multiple scopes into a single dependency map and detect conflicts no individual scope reveals. | Synthesis | 12 |

### Part 2 — Track B: Convert a Legacy App

| Module | # | Lesson title | Learning objective | Type | Min |
|---|---|---|---|---|---|
| M3B | 3B.1 | Why You Never Feed Legacy Source Straight to an AI | Explain why raw legacy source produces unreliable conversions, and describe what extraction fixes. | Concept | 11 |
| M3B | 3B.2 | Pick Your Path: WINDEV/WEBDEV, VB6, or Clarion | Identify which conversion track applies to your application and what input each one requires. | Concept | 10 |
| M3B | 3B.3 | Running the Conversion: From Source to Readable Markdown | Execute the stage-one conversion for your platform and locate the artifacts it produces under `pre-convert/`. | Demonstration | 13 |
| M3B | 3B.4 | What Comes Out: Regenerated Screens, Schema, Queries, Reports | Examine each category of conversion output and judge which parts are faithful and which are drafts to be normalized later. | Worked example | 10 |
| M3B | 3B.5 | **PRACTICE:** Convert One Screen of Your Own App | Produce converted artifacts for a single window, page, or form from your own legacy application. | Practice | 5 |
| M3B | 3B.6 | Where Conversion Gets It Wrong, and How to Tell | Detect the common conversion failures — lost business logic, guessed data types, and silently dropped validation. | Worked example | 12 |
| M4B | 4B.1 | One Scope per Screen, Plus the Three You Always Need | Identify the per-screen scopes plus the Program, Database, and Backend/API scopes that every conversion requires. | Concept | 11 |
| M4B | 4B.2 | Running the Scope Pass: Resumable, Screen by Screen | Execute the conversion scope pass across multiple screens, stopping and resuming without losing work. | Demonstration | 11 |
| M4B | 4B.3 | The Gap-Analysis Pass: What the Legacy App Never Told You | Analyze converted artifacts for undocumented behaviour, implicit business rules, and missing validation. | Worked example | 12 |
| M4B | 4B.4 | Deciding What Not to Rebuild | Evaluate each legacy feature against current need and record an explicit keep, drop, or redesign decision. | Concept | 10 |
| M4B | 4B.5 | **PRACTICE:** Scope Two Screens and Validate Them | Produce validated scope documents for two screens of your own legacy application. | Practice | 5 |

### Part 3 — The Shared Build (both tracks)

| Module | # | Lesson title | Learning objective | Type | Min |
|---|---|---|---|---|---|
| M5 | 5.1 | What createspecs Actually Produces | Identify each artifact the spec pipeline generates and the question each one answers. | Concept | 11 |
| M5 | 5.2 | Specify and Clarify: Killing Ambiguity Before Planning | Execute the specify and clarify stages and resolve every open question the clarify pass raises. | Demonstration | 13 |
| M5 | 5.3 | **PRACTICE:** Run Specify and Clarify on Your Scope | Produce a `spec.md` and a completed requirements checklist for your own approved scope. | Practice | 4 |
| M5 | 5.4 | Plan: Research, Data Model, Contracts, and Quickstart | Construct an implementation plan with its research notes, data model, contracts, and quickstart sub-artifacts. | Demonstration | 10 |
| M5 | 5.5 | Tasks: Turning a Plan Into Checkable Work | Decompose a plan into discrete, individually checkable tasks that map back to specific requirements. | Demonstration | 9 |
| M5 | 5.6 | Registering a Hand-Written Scope Without Losing It | Apply the correct path for ingesting a scope you wrote yourself, so the pipeline preserves it rather than regenerating a weaker version. | Worked example | 10 |
| M6 | 6.1 | The Naming Rules That Keep a Schema Legible | Apply the project's table, key, and field naming conventions to a schema of your own. | Concept | 6 |
| M6 | 6.2 | From Data Model to Schema Definition | Translate the data model produced during planning into a working schema definition. | Demonstration | 9 |
| M6 | 6.3 | Generating Migrations Without Blowing Up Your Data | Generate a migration, review the SQL before it runs, and apply it deliberately rather than automatically. | Demonstration | 9 |
| M6 | 6.4 | dbpush: Syncing Specs, Docs, and Tasks to wxKanban | Execute a dry-run push, interpret its error and warning counts, and correct the source documents. | Demonstration | 12 |
| M6 | 6.5 | **PRACTICE:** Model, Generate, Dry-Run | Produce a schema change, its migration, and a clean dry-run push for your own project. | Practice | 5 |
| M7 | 7.1 | What the implement Command Does and Doesn't Do | Explain the boundary between what the orchestrator automates and what remains your judgement call. | Concept | 11 |
| M7 | 7.2 | Working Task by Task, Not Feature by Feature | Execute implementation one task at a time, verifying each against its spec requirement before moving on. | Demonstration | 10 |
| M7 | 7.3 | **PRACTICE:** Implement Your First Three Tasks | Produce working, committed code for three tasks from your own spec. | Practice | 5 |
| M7 | 7.4 | The Gate: What Stops You Mid-Implementation and Why | Diagnose why an implementation gate has blocked you and choose the correct response rather than bypassing it. | Concept | 11 |
| M7 | 7.5 | Git Discipline the Kit Expects | Apply the project's branching and commit conventions so work stays traceable to its spec. | Demonstration | 9 |
| M7 | 7.6 | When the AI Wants to Go Off-Spec: Say No, Update the Spec | Evaluate an AI suggestion that exceeds the spec and route it correctly — reject it, or stop and amend the spec first. | Worked example | 11 |
| M8 | 8.1 | Requirement-Traceable Testing, Not Vibes | Explain what makes a test plan traceable and why untraceable testing cannot close a phase gate. | Concept | 11 |
| M8 | 8.2 | Building the Test Plan From the Spec | Construct a test plan in which every case maps to a numbered requirement in the spec. | Demonstration | 10 |
| M8 | 8.3 | Running QA and Recording Results | Execute a test run and record pass, fail, and blocked outcomes against the plan. | Demonstration | 9 |
| M8 | 8.4 | Compliance and Audit Passes | Identify which compliance checks apply to your project and interpret the audit report they produce. | Concept | 11 |
| M8 | 8.5 | Fixing Failures Fast: Autofix and the Debug Protocol | Diagnose a failing test using the four-step debug protocol before attempting any fix. | Demonstration | 12 |
| M8 | 8.6 | **PRACTICE:** Take One Spec Through the QA Gate | Produce a completed test run and a filed audit report for one spec of your own. | Practice | 3 |
| M9 | 9.1 | What Humans Catch That Tests Never Will | Describe the classes of defect that only human testing surfaces, and why they cluster at the edges of a spec. | Concept | 10 |
| M9 | 9.2 | Running a Human Test Round | Execute a human test round with a defined scope, defined testers, and a defined way to report. | Demonstration | 12 |
| M9 | 9.3 | Triage: Bug, Change Request, or New Spec? | Classify each piece of feedback into the correct artifact and justify the classification. | Worked example | 12 |
| M9 | 9.4 | Closing the Loop Without Restarting the Project | Evaluate which feedback belongs in this release and which belongs in the next, and record the decision. | Concept | 10 |
| M9 | 9.5 | **PRACTICE:** Run a Round on Your Own App | Produce a triaged feedback list with at least one item converted into a tracked artifact. | Practice | 6 |
| M10 | 10.1 | What "Ready for a Paying Customer" Actually Means | Evaluate an application against a concrete readiness checklist rather than a feeling of doneness. | Concept | 11 |
| M10 | 10.2 | Preparing the Beta | Execute the beta preparation step and identify what it locks down. | Demonstration | 12 |
| M10 | 10.3 | Deploying the Build | Deploy a built application and verify the deployment from outside your own machine. | Demonstration | 9 |
| M10 | 10.4 | **PRACTICE:** Deploy a Beta of Your App | Produce a running, externally reachable beta deployment of your own application. | Practice | 6 |
| M10 | 10.5 | Finalizing the Release and the Release Record | Execute the release finalization and complete the release record with version, method, date, and notes. | Demonstration | 8 |
| M10 | 10.6 | **PRACTICE:** Cut Your First Release | Produce a finalized release of your own application with a complete release record. | Practice | 7 |
| M11 | 11.1 | Your Capstone Brief: Pick Something Small and Real | Design a capstone project scoped small enough to finish and real enough to matter. | Synthesis | 11 |
| M11 | 11.2 | The Session Habit: Starting, Tracking, and Not Losing Your Place | Apply a repeatable session routine so a multi-week project survives interruptions. | Demonstration | 12 |
| M11 | 11.3 | Reading Your Project's Health: Drift Audits and the Dev Plan | Analyze a project for drift between what the specs say and what the code does. | Demonstration | 12 |
| M11 | 11.4 | Keeping the Kit Current Without Breaking Your Project | Execute a kit upgrade and verify afterwards that your project's tooling still behaves correctly. | Demonstration | 10 |
| M11 | 11.5 | **PRACTICE:** Grade Your Own Project Against the Six Gates | Evaluate your own capstone against each phase gate and record where it would fail. | Practice | 10 |
| M11 | 11.6 | Where to Go Next — and Your Next-Project Commitment | Justify your next project choice and write a dated commitment to start it. | Synthesis | 8 |

---

## 4. Sequence Audit

### Check 1 — Prerequisite order

Three forward references were found and fixed.

- **Schema naming rules arrive after schemas are produced.** Track B's Module 3B generates a reconstructed data model in Lesson 3B.4, but the naming conventions that govern it are not taught until Lesson 6.1. **Fix applied:** Lesson 3B.4 now explicitly frames the extracted schema as a *draft to be normalized in Module 6*, and Lesson 6.1 opens by picking that draft back up. Track B students are told not to hand-fix names in Module 3B.
- **The data model is produced in Module 5 but taught in Module 6.** The planning stage (Lesson 5.4) emits a data-model artifact before Module 6 teaches how to model data. **Fix applied:** Lesson 5.4 covers *what the artifact is for* and defers all schema-design judgement to Module 6, which back-references it by name.
- **Students commit code from Module 2 onward, but Git discipline is taught in Lesson 7.5.** **Fix applied:** Lesson 2.6 now ends by having students commit their environment record on a branch, with a one-line forward pointer to Lesson 7.5 for the full convention. No new lesson was added.

### Check 2 — Momentum curve

Four modules originally ran four or more consecutive concept/demonstration lessons before any practice — a reliable way to lose a career-changer in a technical course.

- **Module 2** was resequenced so the health-check practice (2.4) lands immediately after the three setup demonstrations rather than after five lessons.
- **Module 5** was resequenced to insert practice at 5.3, splitting specify/clarify from plan/tasks instead of stacking four demonstrations.
- **Module 7** was resequenced to move the implementation practice to 7.3, so students write code before learning about gates and Git conventions.
- **Module 8** was resequenced to move the compliance concept lesson to 8.4, breaking the run of demonstrations, and to close on practice.

**Remaining honest flag:** Module 2 Lesson 2.3 is the steepest single step in the course — MCP, gateway, and editor extension in fourteen minutes, for an audience that includes people who have never configured a developer tool. This is the most likely drop-off point in the entire curriculum. It is left at one lesson deliberately rather than split, because splitting it strands students in a half-configured state; instead, Lesson 2.6 exists specifically to catch the people it breaks. **Recommendation:** record 2.3 twice — once for Windows, once for macOS — rather than switching between them in one take.

### Check 3 — Practice distribution

Every one of the thirteen modules contains at least one practice lesson. No module is all concept. Three modules (7, 8, 10) carry two hands-on lessons, which is appropriate — these are the modules where the student is operating on their own live application rather than following along.

### Check 4 — Completion markers

Every module ends with something made, decided, or recorded. Marker types are deliberately mixed rather than repeating the same form: written intent and a recorded decision (M1), a verified system state (M2), produced documents (M3A, M4A, M4B, M9), extracted artifacts (M3B), a clean tool run (M4A, M6), working committed code (M7), a recorded test run (M8), a live deployment and a release record (M10), and a self-assessment plus a commitment statement (M11).

Two markers were weak on first pass and were strengthened: **Module 2** originally ended on a troubleshooting lesson with nothing produced, and now requires a written environment record; **Module 11** originally ended on a "where to go next" concept lesson, and now closes with a dated written commitment.

### Check 5 — The quick win

**Lesson 1.3, "Write the One-Page Intent That Changes Every AI Answer,"** begins roughly 21 minutes into the course and produces a result the student can use the same day — on any project, with any AI tool, whether or not they ever install wxKanban. It passes all five quick-win tests: it is early, it is visible, it is useful standing alone, it is specific to this course's method rather than generic advice, and Lesson 1.3 names the win explicitly rather than letting it pass unremarked.

---

## 5. Two Notes Worth Your Attention

**On total length.** You chose comprehensive, and this is comprehensive: roughly **11h 40m to record**, with each student watching about **9.8 hours**. That is a serious production commitment for a free onboarding course, and completion rates on free 11-hour courses are unforgiving. A concrete mitigation, rather than cutting content: designate a **Core Path** of roughly 28 lessons (~4h 30m) covering Modules 1, 2, the student's Part 2 track, 5, 7, and 10, and publish it in YappChat Training as a separate course drawing on the *same recordings*. Completers of the Core Path then have an obvious next step, and nobody has to record anything twice. This is a publishing decision, not a curriculum change — the blueprint above supports it as-is.

**On the two tracks.** The split is narrower than it first appears, and that is a good thing. Tracks A and B diverge for exactly two modules — the ones that get you to an approved scope — and then rejoin permanently. Everything from Module 5 onward is identical for both audiences, because once a scope is approved the orchestrator does not care where it came from. Two tracks costs you four modules of recording instead of two; it does not cost you two courses.

---

*Generated by the curriculum-architect skill against `config.json`.*

