# Core Module 5 — Build It

**Course:** wxKanban Spec-First · **Module:** data model + implementation
**Lessons:** 6.1, 6.2, 6.3, 6.5, 7.2, 7.5, 7.3 — **Core Path order**
**Platform:** Windows

> **Production notes.**
>
> **1. Seven lessons, two halves, one module.** Lessons 6.x are the data model; 7.x are implementation. In the Full course these are separate modules (M6 and M7); the Core Path merges them. The scripts are written so that either grouping reads naturally — no lesson refers to "this module" in a way that breaks if the boundary moves.
>
> **2. Core reordering.** 7.5 (Git) runs *before* 7.3 (the implementation practice) in Core, so the module closes on hands-on work. In the Full course 7.3 comes first. Neither script refers to the other, so one recording serves both.
>
> **3. Two forward-reference debts get paid here.** Track B students were told in 3B.4 not to hand-fix their extracted legacy schema, and everyone was told in 5.4 that the data model is the business shape rather than the schema. Lesson 6.1 picks both up explicitly. If you cut that acknowledgement, those students are left hanging.
>
> **4. Slots are not re-baselined in this file.** Actual narration is recorded at the end of each script; the consolidated re-baseline happens once Core Module 6 is scripted, as promised in the Core Path document.

---
---

# Lesson 6.1 — The Naming Rules That Keep a Schema Legible

**Type:** Concept · **Slot:** 10 minutes

**Learning objective:** Apply the project's table, key, and field naming conventions to a schema of your own.

---

## HOOK

[SHOW ×L: title card — "Lesson 6.1 · Naming Rules That Keep a Schema Legible"]

I'm going to give you a set of naming rules, and there's a decent chance you'll disagree with at least one of them.

That's fine. Here's the thing I'd ask you to hold on to anyway: **a convention you mildly dislike, applied everywhere, beats three conventions you like, applied inconsistently.** Every time. It isn't close.

Because the cost of naming isn't in choosing. It's in *remembering*. Every time you have to stop and think "is it userId, user_id, or userid in this table?", you've paid. Multiply by every query for the next five years.

## OBJECTIVE

In this lesson we're going to cover the naming conventions this project enforces, so that you can apply them to your own schema without stopping to decide.

## BEAT 1 — Two debts to settle first

Before the rules, two promises I made earlier.

If you came through **conversion**, I told you not to hand-fix the names in your extracted legacy schema. This is where that gets done properly — with the convention in front of you, once, rather than screen by screen from memory.

And for **everyone**: back at the planning stage, the data model described your business — Customer, Booking, Slot. Not tables. This is where business shape becomes database structure, and it's a real translation, not a rename.

## BEAT 2 — The rules

[SHOW ×L: the four naming rules on screen]

Four of them.

**Tables are plural, lowercase, and run together.** `users`. `projecttasks`. `companyauditlogs`. No camelCase, no underscores between words.

The run-together part is the one people object to, and I understand why — `companyauditlogs` is not beautiful. But it removes an entire category of question. There's no "is it project_tasks or projectTasks" because there's only one shape available.

**Every primary key is `id`**, and it's a UUID version seven.

Version seven matters and it's worth thirty seconds. A classic random UUID is scattered — consecutive inserts land in unrelated places in the index, and the index fragments. A version-seven UUID has a timestamp at the front, so it sorts roughly by creation time. You get the uniqueness of a UUID with much better insert behaviour, and a key you can sort by age without a separate column.

**Foreign keys are the parent table's name plus `id`.** A row pointing at `users` has a `userid`. Pointing at `projects`, a `projectid`.

Which means you can read a join without looking anything up. `userid` goes to `users.id`. There is no second rule.

**Fields are lowercase and run together.** `createdat`. `accesstoken`. Same logic as tables.

## BEAT 3 — Why consistency beats preference

[PAUSE]

Let me make the case properly, because "be consistent" is the emptiest advice in software and I don't want to leave it there.

Your AI assistant writes queries against this schema. So do you, at eleven at night. So does whoever inherits it.

Every naming inconsistency is a lookup. Not an error — a *lookup*. A moment where you can't proceed from knowledge and have to go and check. Individually trivial, and they're the texture of what "this codebase is painful" actually means.

A consistent schema is one you can write against from memory. That's the whole prize, and it's worth more than any individual naming preference either of us holds.

## BEAT 4 — Where the model and the schema legitimately differ

One nuance, so you don't over-apply this.

Your data model said Customer, Booking, Slot — singular, capitalised, business language. Your schema says `customers`, `bookings`, `slots`. That's correct. Both are right in their own document.

Don't rewrite the data model to match the schema. It's describing your business to a human, and "a Booking belongs to a Customer" is the right sentence there. The translation happens once, here.

## SUMMARY

Four rules. **Tables**: plural, lowercase, run together. **Primary key**: always `id`, UUID v7 for sortable, index-friendly keys. **Foreign keys**: parent table name plus `id`. **Fields**: lowercase, run together.

And the reason underneath all four: a schema you can write against from memory.

## ACTION STEP

Take the data model from your plan and write the table list — just names, no fields. Ten minutes.

Then check every one against the four rules. If you came through conversion, do this against your extracted schema instead; expect most names to change, and change them here rather than one at a time later.

## BRIDGE

You have names. Next they become an actual schema definition.

---
---

# Lesson 6.2 — From Data Model to Schema Definition

**Type:** Demonstration · **Slot:** 13 minutes

**Learning objective:** Translate the data model produced during planning into a working schema definition.

---

## HOOK

[SHOW ×L: title card — "Lesson 6.2 · Model to Schema"]

This is a translation, and like every translation it has one dangerous move: adding things the original didn't say.

Watch for it in yourself as we go. The moment you start adding a table "because we'll probably need it", you've stopped translating and started inventing — and you're inventing without a requirement, which is the exact thing this whole method exists to prevent.

## OBJECTIVE

In this lesson we're going to turn a data model into a schema definition, so that every table you create traces back to something the model actually describes.

## BEAT 1 — Entities become tables, one for one

[SHOW: the data model beside the emerging schema]

Start mechanically. Every entity in the model becomes a table. Apply the naming rules. Nothing clever yet.

Delphine's model has Customer, Booking, Slot, and Dog — and Dog is there because a groomer needs to know the breed and temperament before arriving, which came out of a requirement rather than someone's imagination.

Four entities, four tables: `customers`, `bookings`, `slots`, `dogs`.

**If your model has an entity you can't map to a table, stop.** Either it isn't really an entity — it's an attribute wearing a costume — or your model is describing something the schema needs to handle differently. Both are worth ten minutes now.

## BEAT 2 — Relationships become foreign keys

[SHOW ×L: relationship diagram with the resulting keys]

Now the relationships, and the rule is boring on purpose: the *many* side carries the key.

A customer has many bookings. So the key lives on `bookings`, as `customerid`. Not the reverse — a list of booking IDs on the customer row is how you get data you can't query and can't keep consistent.

A booking is for one dog, which belongs to one customer. So `bookings` gets a `dogid`, and `dogs` gets a `customerid`.

[PAUSE]

Here's something worth noticing, and it's the sort of thing this exercise surfaces for free: a booking now reaches a customer by two routes — directly, and via the dog.

That's a design question, not an error. Can someone book a groom for somebody else's dog? If yes, both keys are right and they mean different things. If no, one of them is redundant and should go.

Answer it now, in the schema, deliberately. This is exactly the kind of question that otherwise gets answered accidentally by whoever writes the first query.

## BEAT 3 — Fields, types, and the two that are never optional

[SHOW: a table definition being written out]

Fields come from the model's attributes plus what the requirements imply.

Two things every table gets: an `id`, and `createdat`. The second one seems like housekeeping until the first time somebody asks "when did this start happening?" and you cannot answer for any row in your database.

On types: be tighter than feels comfortable. A status column that can hold any string will eventually hold four spellings of "cancelled". Constrain it to the values your requirements actually name.

And if you came through conversion, this is where those inferred legacy types get corrected. The converter guessed from documentation; you know.

## BEAT 4 — What not to add

Last, and it's a discipline rather than a technique.

Do not add tables for features that aren't specified. No `auditlogs` because it seems responsible. No `settings` because applications usually have one. No `tags` because they might be nice.

[PAUSE]

Every one of those is plausible. That's what makes them dangerous. Each unspecified table is something to migrate, maintain and reason about forever, added because it felt professional at eight o'clock one evening.

If you genuinely believe one is needed, the move is the same as always: go and add the requirement, then come back. Two minutes, and the chain stays intact.

## SUMMARY

**Entities become tables**, one for one, named by the rules. **Relationships become foreign keys on the many side** — and any relationship that resolves two ways is a design question to settle deliberately. **Every table gets `id` and `createdat`**, and types should be tighter than feels natural. And **nothing gets added that isn't specified** — if you're sure it's needed, add the requirement first.

## ACTION STEP

Write the schema definition for your own feature. One table per entity, keys on the many side, no extras.

Then do one pass with a single question against every table and column: **which requirement is this serving?** Anything with no answer either loses the column or gains a requirement.

## BRIDGE

A schema definition isn't a database yet. Next we turn it into one — carefully.

---
---

# Lesson 6.3 — Generating Migrations Without Blowing Up Your Data

**Type:** Demonstration · **Slot:** 12 minutes

**Learning objective:** Generate a migration, review the SQL before it runs, and apply it deliberately rather than automatically.

---

## HOOK

[SHOW ×L: title card — "Lesson 6.3 · Migrations, Carefully"]

Everything up to now has been reversible. Delete a scope document and you've lost an afternoon's thinking; annoying, survivable.

Migrations are different. A migration is the first thing in this course that can destroy something you cannot get back.

So this lesson has one idea in it, and everything else is detail: **generating a migration and applying a migration are two separate acts, and a human reads the SQL in between.**

## OBJECTIVE

In this lesson we're going to generate a migration and review it before applying, so that nothing runs against your database that you haven't read.

## BEAT 1 — Generate is not apply

[SHOW: terminal, generating a migration]

Generation compares your schema definition against what the database currently has, works out the difference, and writes it as a SQL file.

It writes a file. It does not touch the database.

That gap is deliberate, and I want you to treat it as sacred. The file is a proposal. You read the proposal. Then you decide.

Plenty of tooling in the world collapses those two steps in the name of convenience. What that convenience buys you is a single command that can drop a column while you're looking at something else.

## BEAT 2 — Reading the SQL, and the four to slow down for

[SHOW ×L: a generated migration file with the risky statements highlighted]

Open it. It's usually short.

Most of what you'll see is safe: creating a table, adding a nullable column, adding an index. Fine.

Four things should make you stop.

**`DROP COLUMN`** — that data is gone. Sometimes correct. Never skim it.

**`ALTER COLUMN ... TYPE`** — a type change rewrites existing values, and anything that doesn't fit the new type either errors or truncates.

**Adding `NOT NULL` to an existing column** — it fails outright if any row is null, which is the good outcome. The bad outcome is a default you didn't intend being written across every historical row.

**A rename** — and this is the sneaky one. Tools frequently express a rename as a drop plus an add, because they can't tell a rename from "delete this, create that". The generated SQL will happily throw away the column's contents and give you a shiny empty replacement.

[PAUSE]

That last one is the single most common way people lose data in a migration, and it looks completely innocuous in a diff.

## BEAT 3 — Applying it

[SHOW: terminal, applying the migration]

Once you've read it, apply it. Three habits.

**Apply to development first**, always, even when it's obviously fine.

**Once there's real data, back up first.** Not "consider backing up". The backup is not for the migrations you're worried about — you're careful with those. It's for the one you were sure about.

**One migration, one purpose.** A migration that adds a table and changes three types and drops a column is a migration you can't reason about and can't partially undo.

And a note for right now: today your database is probably empty, so all of this feels theoretical. Build the habits while the stakes are zero, because the habits are what you'll have when they aren't.

## BEAT 4 — Migrations are part of the record

Last thought, briefly.

Migration files are permanent and they're read. Six months on, they're the honest history of how your data model actually evolved — including the bits nobody wrote down anywhere else.

So don't edit a migration that's already been applied. Write a new one. The applied file is a record of what happened, and rewriting history in the one place that records it is how you end up with two environments that disagree and nobody able to explain why.

## SUMMARY

**Generate and apply are separate acts**, with a human reading SQL in between. **Four things to slow down for**: dropped columns, type changes, new NOT NULL constraints, and renames that come out as drop-plus-add. **Development first, back up once data is real, one migration one purpose.** And **never edit an applied migration** — write a new one.

## ACTION STEP

Generate the migration for your schema and read every line before applying it.

Then write yourself a two-line note: what this migration does, and anything in it you'd call risky. Keep it with your project notes.

The day you do have production data, that habit is the difference between a careful change and a hopeful one.

## BRIDGE

Time to do all three yourself, end to end.

---
---

# Lesson 6.5 — PRACTICE: Model, Generate, Dry-Run

**Type:** Practice · **Slot:** 7 minutes narration plus student work

**Learning objective:** Produce a schema change, its migration, and a clean dry-run push for your own project.

---

## HOOK

[SHOW ×L: title card — "Lesson 6.5 · PRACTICE: Model, Generate, Dry-Run"]

Three steps, one sitting. Schema, migration, and then a check that the rest of your project still agrees with itself.

## OBJECTIVE

In this lesson you're going to take your own feature from data model through migration to a clean dry-run push.

## BEAT 1 — What you're producing

A schema definition for your feature, a generated migration you've actually read, and a **dry-run push reporting zero errors**.

That third one is new, so let me explain what it does.

Your specs and tasks live in two places — your folder and the board. The push is what keeps them in step. And the **dry run** does the whole job except the writing: it parses everything, validates it, and tells you what it *would* send.

What you want to see is an error count of zero, and a sensible number of specs and documents. If the count is wrong or errors appear, something in your documents is malformed — and finding that in a dry run costs nothing.

## BEAT 2 — The rules

**Read the migration before applying it.** Every line. Even if it's four lines.

**Dry run before any real push.** Always. It's free.

**Zero errors, not "only a couple".** An error means a document doesn't parse the way the tooling expects, and that document is not going to arrive intact.

**Don't fix errors by deleting content.** If a spec fails to parse, the fix is the malformed section, not removing it.

## BEAT 3 — Reading the output

The dry run reports how many specs it parsed, how many documents it would write, which directories it skipped, and an error count.

The skipped list is worth a glance rather than a worry — it names things that don't match the expected folder pattern, and that's usually correct: archives, plans, loose files.

The number to actually check is **errors: zero**. And the spec count, against what you expect to exist. If you have twelve specs and it parsed nine, three folders aren't shaped the way the tooling expects.

[PAUSE]

Now pause and run all three steps. Come back with a clean dry run.

[PAUSE — "Pause here. Schema, migration, dry run. Then come back."]

## BEAT 4 — What good looks like

Three signs.

**You found something in the migration you had to think about.** Almost everyone does on a first schema.

**Your dry run reported zero errors** — and if it didn't at first, you fixed the document rather than removing it.

**The spec count matched what you expected.** If it didn't, you now know something you'd otherwise have discovered much later and much more confusingly.

## ACTION STEP

The practice is the action step. Save your migration, and note the dry-run numbers — specs parsed, documents, errors — in your project notes.

That's a baseline, exactly like the health check from setup. Next time the numbers look odd, you'll have something real to compare against.

## BRIDGE

The data has a home. Now we write the code that fills it.

---
---

# Lesson 7.2 — Working Task by Task, Not Feature by Feature

**Type:** Demonstration · **Slot:** 13 minutes

**Learning objective:** Execute implementation one task at a time, verifying each against its spec requirement before moving on.

---

## HOOK

[SHOW ×L: title card — "Lesson 7.2 · One Task at a Time"]

Before we run anything, the boundary — because knowing what this does and doesn't decide is what keeps you in control of it.

**The orchestrator decides**: which tasks exist, what order they're available in, whether the spec is in a phase where implementation is allowed, and what gets recorded when a task changes state.

**You decide**: whether the code is right, whether a task is genuinely done, and what happens when reality disagrees with the spec.

[PAUSE]

Nothing in this stage removes your judgement. It removes the *bookkeeping* around your judgement, which is a different thing and the reason any of this is worth doing.

## OBJECTIVE

In this lesson we're going to run implementation for a spec, so that you work task by task with each one verified against its requirement before you move on.

## BEAT 1 — It validates before it starts

[SHOW: terminal, implement validating the spec]

First it checks three things: that the spec exists, that it's in a phase where implementation is allowed, and that nothing it depends on is blocking.

That middle check is the six-phase lifecycle doing its job. A spec still sitting in design doesn't get implemented — not as an obstacle, but because a spec in design is one nobody has approved, and building it means building something that may still change.

There's also a dry-run option, and it's worth using on your first spec: it shows you what it *would* do without doing it. A cheap way to see the shape of the work.

## BEAT 2 — One task, three possible states

[SHOW ×L: task state diagram — todo, in progress, done, blocked]

Then it works through the tasks, and each one moves between states: **in progress** when started, **done** when finished, **blocked** when it can't proceed.

I want to spend a moment on **blocked**, because people avoid it and it's the most useful of the three.

Blocked doesn't mean you failed. It means this task cannot proceed for a reason outside itself — a decision you don't have, an answer you're waiting on, a dependency that isn't ready.

Marking something blocked does two things. It stops you circling a task you cannot finish. And it makes the reason *visible* — on the board, to anyone looking — instead of hiding in your head as "the bit I keep not doing".

The alternative is a task that stays "in progress" for nine days while you quietly work around it. Everyone has done it. It teaches nobody anything.

## BEAT 3 — The verification that makes this work

[SHOW: a task beside its requirement]

Here's the habit that makes the whole method pay off, and it takes about twenty seconds per task.

Before you mark a task done, **open the requirement it links to and read it.**

Not from memory. Read it. Then ask: does what I just built satisfy *that sentence*?

[PAUSE]

Most of the time, yes, and you've spent twenty seconds. But the times it isn't — and there will be some — you've caught drift at the only moment it's cheap. You built something reasonable that isn't quite what was specified. Right now that's a five-minute correction. Three weeks later it's a defect with a paper trail.

This is the whole chain doing its job in one small motion. Scope constrains spec, spec constrains task, task constrains code — and that constraint only actually exists if somebody checks.

## BEAT 4 — The advisory review, and who decides

[SHOW ×L: review findings ordered must-fix / should-fix / nit]

Something happens after the run that surprises people the first time.

It reviews the code it just produced — scoped to *this run's changes*, not your whole repository — and prints findings ordered by severity: must-fix, should-fix, and nits. If the run touched front-end files, it reviews the interface too.

And then it stops. It does **not** apply the fixes. It doesn't restyle anything, doesn't edit your code, doesn't mark tasks blocked on its own opinion. Even must-fix findings don't fail the run.

That restraint is the point. The review is a colleague's second opinion delivered immediately, while the change is fresh in your head — and you remain the one who decides. A review that silently applied its own conclusions would be a code generator wearing a review's clothing.

Read them. Act on what's real. Ignore what isn't, deliberately.

## SUMMARY

Four things.

The orchestrator handles **bookkeeping**; you keep the **judgement**. It **validates the spec and its phase** before starting. Tasks move through **in progress, done, or blocked** — and blocked is a useful, visible answer rather than an admission. **Read the requirement before marking anything done.** And the **review advises, you decide**.

## ACTION STEP

Before the next lesson, run implementation for your spec with the dry-run option only. Don't build anything yet.

Read what it says it would do, and check that against your task list. If it plans something you didn't expect, that's worth understanding before code exists rather than after.

## BRIDGE

One more thing to set straight before you write code — who is allowed to touch your history.

---
---

# Lesson 7.5 — Git Discipline the Kit Expects

**Type:** Demonstration · **Slot:** 11 minutes

**Learning objective:** Apply the project's version-control conventions so work stays traceable to its spec — and understand the guardrails that protect it.

---

## HOOK

[SHOW ×L: title card — "Lesson 7.5 · Who Is Allowed to Touch Your History"]

This lesson isn't really about branch names.

It's about a set of rules that exist because an AI assistant, trying to be helpful, deleted somebody's work. More than once. Those rules are now enforced by something that physically blocks the operation.

If you're new to working with AI on real code, this is the most important safety lesson in the course.

## OBJECTIVE

In this lesson we're going to cover the version-control rules this project enforces, so that you know exactly what your assistant may and may not do to your history — and why.

## BEAT 1 — Rule one: it does not commit unless you say so

[SHOW ×L: the rule, stated plainly]

The first rule is that your assistant never commits, checkpoints, merges or pushes unless you explicitly ask, in that message.

And the rule is drawn tightly, which is what makes it work.

Finishing a task is **not** permission. You saying "done" or "looks good" is **not** permission. Having asked for a commit ten minutes ago is **not** ongoing permission. There's no such thing as a good stopping point that grants it.

[PAUSE]

Why so strict? Because **the git timeline is yours.** It's the record of how your project came to be, and it's the thing you fall back on when something goes wrong. An assistant committing on its own judgement is writing in your permanent record based on its guess about what's finished.

You'll notice it *not* doing this, and it can feel unhelpful the first few times. That's the rule working.

## BEAT 2 — Rule two: the destructive commands are blocked

[SHOW ×L: the forbidden command list]

The second rule is harder. There's a set of commands the assistant may not run at all without you explicitly saying so: checkout over a file, reset, revert, restore, clean.

What those have in common is that they **destroy uncommitted work**, instantly and silently.

And this rule exists for a specific, documented reason: assistants used these commands to "fix" their own mistakes — reverting a file to undo a bad edit — and in doing so deleted hours of completed work that happened to be in the same file.

[PAUSE]

Read that again, because it's the failure mode. Not malice, not incompetence. A tidy-minded correction that took everything else with it.

It's now enforced. A hook blocks the operation before it runs. If you genuinely want one of those commands, you ask for it explicitly — and the guard has to be deliberately set aside.

## BEAT 3 — What it does instead

So what happens when your assistant does make a mistake in a file? Because it will.

It fixes it **forward** — reads the file, edits the wrong part, writes it back. Or it asks you what you want.

That's slower than reverting. It's also the only version that can't take your morning with it.

And there's a lesson in it for you as well, not just the tool. When something's wrong in a file you're working on, the instinct to throw it away and start clean is strong and usually wrong. Fix forward.

## BEAT 4 — Your side of the discipline

[SHOW: branch and commit example]

The tool's restraint doesn't make the timeline good on its own. Three habits.

**A branch per spec.** Name it for the spec number and its slug. When you come back in three weeks you'll know exactly what it was, and so will anyone reviewing it.

**Commit at task boundaries.** Not at the end of the day, not when you remember. A task is a unit of finished work — that's precisely what makes it a good commit.

**Say what changed and why, and reference the spec.** Six months on, "fixes" tells you nothing. The spec number tells you everything, because it points at a document that explains the whole reasoning.

Do those three and your history becomes something you can actually read. Which, on the day you need it, is the only thing that matters.

## SUMMARY

**Your assistant does not commit unless asked in that message** — finishing work isn't permission. **Destructive commands are blocked**, because they have destroyed real work by "fixing" mistakes. It **fixes forward instead**, and so should you. And your side: **branch per spec, commit at task boundaries, reference the spec number.**

The timeline is yours. Everything here exists to keep it that way.

## ACTION STEP

Create the branch for the spec you're about to implement, named for its number.

Then a two-minute exercise that's worth more than it sounds: open your last three commit messages on any project and ask whether they'd tell you anything useful in six months.

Most people find they wouldn't. That's the habit this lesson is trying to change.

## BRIDGE

Guardrails understood, branch created. Time to actually build something.

---
---

# Lesson 7.3 — PRACTICE: Implement Your First Three Tasks

**Type:** Practice · **Slot:** 6 minutes narration plus student work

**Learning objective:** Produce working, committed code for three tasks from your own spec.

---

## HOOK

[SHOW ×L: title card — "Lesson 7.3 · PRACTICE: Your First Three Tasks"]

Three tasks. Not the whole spec — three.

## OBJECTIVE

In this lesson you're going to implement three tasks from your own spec, verifying each against its requirement and committing each one separately.

## BEAT 1 — What you're producing

Three completed tasks, each verified against its requirement, each its own commit, on a branch named for the spec.

**Three, deliberately.** Long enough to feel the rhythm, short enough that if the rhythm is wrong you find out today rather than after twenty.

Pick the three that come first. Don't cherry-pick the easy ones — you're testing the process, and the process has to survive a task you don't already know how to do.

## BEAT 2 — The rules

**Read the requirement before marking anything done.** Every time. Twenty seconds.

**One commit per task**, referencing the spec.

**If a task can't proceed, mark it blocked and say why.** Don't sit on it, don't work around it silently.

**Read the review findings at the end**, and decide on each. Deciding to ignore a nit is a decision; not reading it isn't.

**Don't fix the fourth thing you notice.** You will spot something adjacent that wants fixing. Write it down and leave it. That instinct, unchecked, is how a three-task session becomes a six-hour one with no clear record of what changed.

## BEAT 3 — Before you start

One setup step, thirty seconds: open your `tasks.md` and read the three tasks you're about to do, out loud if you can.

If any of them isn't obviously provable as done, split it now, before you write code. That's much easier now than at the point where you're trying to decide whether to tick a box.

[PAUSE]

Now go and do it. Come back when three boxes are ticked and three commits exist.

[PAUSE — "Pause here. Three tasks. Then come back."]

## BEAT 4 — What good looks like

Four signs.

**Every task took less than half a day.** If one took two days, it was more than one task — and now you know how your estimates run.

**At least once you re-read the requirement and adjusted something.** That's drift caught at the cheap moment. It's the method paying for itself.

**Your three commits tell a story.** Read them back. They should describe the work, not just mark that it happened.

**You wrote something down instead of fixing it.** The discipline of not chasing the adjacent thing is harder than it sounds and matters more than it sounds.

## ACTION STEP

The practice is the action step. Push nothing, merge nothing — the branch stays where it is for now.

One last thing, two minutes: note how long the three tasks actually took, against what you'd have guessed. Keep that ratio. It's the first honest estimate you have for your own work on this project, and every plan you make from here gets better for it.

## BRIDGE

Code exists, and it's traceable to requirements. Next: proving it does what you said it would.

---

*Generated by the lesson-scripter skill. Sources: the project's database conventions, the shipped git rules, and the live implement command definition including its advisory review phase.*
