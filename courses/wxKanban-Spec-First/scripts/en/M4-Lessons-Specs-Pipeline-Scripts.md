# Core Module 4 — From Scope to Specs

**Course:** wxKanban Spec-First · **Module:** the createSpecs pipeline
**Lessons:** 5.2, 5.3, 5.4, 5.5 — **both tracks converge here**
**Platform:** Windows

> **Production notes.**
>
> **1. This is where the two tracks rejoin.** Everything from here is identical whether the student built a scope from an idea or extracted it from a legacy application. Say so in 5.2 — Track B students in particular have been on a different road for two modules and should be told explicitly that they're back on the main one.
>
> **2. Lesson 5.2 opens with a 90-second artifact map.** Required by the Core Path, because 5.1 (What createspecs Actually Produces) is cut there. In the Full course 5.1 covers the same ground at length, so the map is a brief recap rather than a duplicate — keep it to 90 seconds and it reads as reinforcement in both orders.
>
> **3. Narration at or below 85% of slot.** Demos absorb the gap with on-screen action; practice lessons run short by design.
>
> **4. This module ends on a demonstration, not a practice lesson.** Flagged and accepted in the Core Path audit — 5.5 ends with the student decomposing their own plan, so the artifact exists even though the lesson type says demonstration. Do not restructure to "fix" it.

---
---

# Lesson 5.2 — Specify and Clarify: Killing Ambiguity Before Planning

**Type:** Demonstration · **Slot:** 13 minutes · **Narration target:** ~8 min plus screen action

**Learning objective:** Execute the specify and clarify stages and resolve every open question the clarify pass raises.

---

## HOOK

[SHOW ×L: title card — "Lesson 5.2 · Specify and Clarify"]

Both roads meet here.

If you came through the new-build track, you have an approved scope you wrote from an idea. If you came through conversion, you have scopes extracted from a legacy application. From this lesson to the end of the course, you're doing exactly the same thing — because once a scope is approved, the pipeline doesn't care where it came from.

What we're about to do is turn that scope into something a developer can build from. And there's one rule that governs the whole stage: **every ambiguity you leave in gets resolved by somebody else later, probably wrongly, probably at the worst moment.**

## OBJECTIVE

In this lesson we're going to run the specify and clarify stages, so that you finish with a specification whose open questions have been found and answered rather than discovered during implementation.

## BEAT 1 — The 90-second map: what gets produced, and where it lands

[SHOW ×L: the artifact map — spec, plan, tasks, tests, quickstart, lifecycle, checklist]

Quickly, so you recognise everything when it appears.

One command produces a set of files, and each answers a different question. **`spec.md`** — what it must do. **`plan.md`** — how it will be built. **`tasks.md`** — the work, in checkable pieces. **`tests.md`** — how you'll know it works. **`quickstart.md`** — how a developer gets running. **`lifecycle.json`** — where it is in the six phases. And a **requirements checklist** alongside them.

One more thing about *where* they land, because it catches people.

The pipeline writes to **two places**: your project's board, and your folder on disk. The board copy is created by the hosted service. The disk copy has to be written locally, because a server on the internet cannot reach into your working tree.

[PAUSE]

That matters for one reason: it is possible to end up with specs that exist perfectly on the board and don't exist in your `specs/` folder at all. Everything looks right when you check the web app. Nothing is there when you open the editor.

We'll check both at the end of this module. For now just know there are two places, and both have to be true.

## BEAT 2 — Specify: the shape is not negotiable

[SHOW: spec.md being generated in the terminal]

The specify stage turns your scope into `spec.md` — and this file has a required structure, checked automatically before it's accepted.

The headings come in a fixed order: Overview, Business Problem, Actors, Success Metrics, Scope Boundary, Out of Scope, Open Questions, Functional Requirements.

That order isn't decoration. It's an argument. You state the problem before the actors, the actors before what success means for them, and the boundary before you list a single requirement. Anyone reading top to bottom is walked through the reasoning in the order it was built.

And three rules are enforced.

**Actors on `- Primary:` and `- Secondary:` lines** — the same format from the scope stage, checked by pattern here. Write it as bold prose instead and it fails the check outright.

**At least three success metrics, each containing a number** — a digit, a percentage, or a timing threshold. "Fast" doesn't pass. Neither does having only two.

**No TODO or TBD markers, and no near-empty sections.** A section with eight words in it is treated as unfinished, because it is.

[PAUSE]

I like this check for a reason that isn't obvious. It isn't judging your *thinking* — it can't. It's checking that you did the *work*. And the failures it catches are almost always the sections someone rushed at the end.

## BEAT 3 — Clarify: the questions you didn't want to be asked

[SHOW: the clarify pass surfacing open questions]

Now the stage that earns the module.

Clarify reads the specification and asks: where is this ambiguous? Where could two competent developers read the same sentence and build different things?

Those become **Open Questions** — and they get their own section in the specification, which is the important part. They aren't hidden in a comment or a chat log. They're in the document, numbered, waiting.

Here's how to work them. Each open question ends in one of exactly two states.

**Answered** — you resolve it and write the answer in, replacing the question.

**Explicitly deferred** — you record the question, say why it isn't being answered now, and state what you'll do in the meantime.

What you must not do is leave it sitting there unmarked, because an unanswered open question is a decision that will be made without you.

Look at spec 092 in a real project and you'll see this done properly — questions marked `RESOLVED` with the date and the actual decision, kept in the document rather than deleted. Six months later, anyone can see not just what was decided but that it was decided deliberately.

## BEAT 4 — Where the answers come from

One practical thing, because this is the point students stall.

Some open questions you can answer yourself in thirty seconds. Some you genuinely cannot — they need the customer, or a colleague, or Marie at the trade counter.

Do not guess those. And do not stop the whole pipeline waiting for them either.

Answer what you can. For the rest, write the question down properly, name who can answer it, and mark it deferred with the interim decision you're proceeding on. Then keep going.

[PAUSE]

A specification with three clearly-marked open questions is a professional document. A specification with three *invisible* assumptions is a liability that looks identical from the outside.

## SUMMARY

Four things.

The pipeline produces a **file set**, and it lands in **two places** — board and disk, both must be true. `spec.md` has a **fixed heading order and three enforced rules**: actor line format, three measurable metrics, no placeholders. **Clarify surfaces ambiguity as numbered open questions** in the document itself. And every question ends **answered or explicitly deferred** — never just sitting there.

## ACTION STEP

Run specify and clarify on your own approved scope, then do one thing before the next lesson.

Take the open questions it raised and split them into two lists: ones you can answer today, and ones that need somebody else. Answer the first list now. For the second, write the name of the person next to each one.

That second list is your next conversation, and it's worth more than another hour of writing.

## BRIDGE

You have a specification with the ambiguity dragged into the open. Next it becomes a plan — how it actually gets built.

---
---

# Lesson 5.3 — PRACTICE: Run Specify and Clarify on Your Scope

**Type:** Practice · **Slot:** 6 minutes narration plus student work

**Learning objective:** Produce a `spec.md` and a completed requirements checklist for your own approved scope.

---

## HOOK

[SHOW ×L: title card — "Lesson 5.3 · PRACTICE: Specify and Clarify"]

Short one. You've seen it; now run it on your own scope and deal with what it finds.

## OBJECTIVE

In this lesson you're going to produce a specification for your own scope with every open question either answered or explicitly deferred.

## BEAT 1 — What you're producing

A `spec.md` for one scope, plus its requirements checklist, with an Open Questions section where every entry is resolved or deliberately parked.

**One scope.** If you produced several — likely if you came through conversion — take the one you understand best. The point is to learn the loop, not to grind through a backlog.

## BEAT 2 — The rules

**Let the checks fail.** If it rejects your actors or your metrics, good — that's the check earning its place. Fix and re-run. It's safe to run repeatedly on the same spec number.

**Answer open questions in writing, in the document.** Not in your head, not in a note.

**Anything you can't answer gets a name attached** — the person who can.

**Don't move on to planning until the open questions section is clean.** Clean means resolved or explicitly deferred, not empty.

## BEAT 3 — The trap to expect

One prediction, because it catches most people on the first run.

Your success metrics will fail the check.

You'll have written three things that read like metrics but contain no number — "the export is quick", "users find it straightforward", "the report is accurate". All three fail, and they should.

The fix is the one from earlier: a digit, a percentage, or a time. Not because the tool likes numbers, but because in six weeks you need to be able to say whether you hit it, and "straightforward" has no answer.

[PAUSE]

Now pause and run it. Come back when your open questions are clean.

[PAUSE — "Pause here. Run specify and clarify. Then come back."]

## BEAT 4 — What good looks like

Three signs.

**At least one open question surprised you.** If none did, the pass probably wasn't given enough to work with.

**At least one question is deferred with a name on it** — that's realistic, not a failure.

**You rewrote a success metric to contain a number, and it hurt slightly.** That flinch is you being made to commit to something checkable. It's the entire point.

## ACTION STEP

The practice is the action step. Save the spec and send the deferred questions to the people whose names you attached, today rather than tomorrow — they're now on someone else's clock, and that clock starts when you send.

## BRIDGE

Requirements settled. Now the how.

---
---

# Lesson 5.4 — Plan: Research, Data Model, Contracts, and Quickstart

**Type:** Demonstration · **Slot:** 14 minutes · **Narration target:** ~8.5 min plus screen action

**Learning objective:** Construct an implementation plan with its research, data model, contracts, and quickstart sub-artifacts.

---

## HOOK

[SHOW ×L: title card — "Lesson 5.4 · The Plan and Its Sub-Artifacts"]

The specification says what must be true. The plan says how you're going to make it true. And keeping those in separate documents is one of the highest-value habits in this whole method.

Here's why, in one sentence: **requirements outlive implementations.** The rule that a customer only sees their own orders will still be true in ten years. The way you enforce it will be rewritten three times. Put them in one document and every rewrite puts your requirements at risk.

## OBJECTIVE

In this lesson we're going to generate an implementation plan and its sub-artifacts, so that you understand what each one is for and which of them your feature actually needs.

## BEAT 1 — The plan is written against your stack, not a generic one

[SHOW: plan.md being generated]

Something happens here that's easy to miss.

Before writing the technical sections, the pipeline reads your project's captured stack — the one recorded when you created the project, back at the very start. Your backend, your frontend framework, your database, your component library, your test tooling, and your design tokens.

So the plan is written against *your* stack. Not a house default, not the most popular choice this year.

[PAUSE]

This is the payoff for the screen I asked you to slow down on when you created the project. If you filled that in honestly, this plan is about your project. If you guessed, this plan is about the guess — and it's now been written into a document that tasks get generated from.

That's what I meant by a confident wrong answer being worse than an empty one.

## BEAT 2 — The four sub-artifacts, and which you need

[SHOW ×L: the four sub-artifacts listed]

The plan can carry four supporting documents. You will not always need all four, and generating ones you don't need is noise.

**Research** — for when there's a genuine unknown that must be settled before building. A library choice, a protocol, a limit you're unsure of. If you have no open technical questions, you don't need one.

**Data model** — the entities, their fields, their relationships. Needed the moment your feature stores anything.

**Contracts** — the interfaces between parts. API shapes, event payloads. Needed as soon as two components have to agree on something. This is the one people skip and regret, because a disagreement about a payload shape surfaces at integration time, which is always the worst time.

**Quickstart** — how a developer gets this running locally. Feels like documentation nobody reads. It's the file that saves you when you come back in four months, or when someone else joins.

## BEAT 3 — The data model here, and the schema later

[SHOW: the data model artifact]

A word on the data model, because there's an ordering that confuses people.

What's produced here is the **model** — entities, fields, relationships, in the language of your business. Customer. Booking. Slot.

It is not yet your schema. It doesn't follow the naming conventions, there are no migrations, nothing is created.

There's a whole module on that shortly, and it exists because doing it properly needs its own attention. So when you read this artifact, judge it on whether the *business* is right — is a booking really attached to a customer, is a slot really separate from a booking. Don't judge it on names or types. Those get settled later, deliberately.

If you came through the conversion track, this is exactly where your extracted legacy schema is heading too. Same rule: don't hand-fix it now.

## BEAT 4 — Read the plan as an argument

[SHOW: the finished plan.md open]

Last thing, and it's about how to read what you get.

A plan is not a to-do list. It's an argument for a particular approach — and you should read it the way you'd read a colleague's proposal, not the way you'd read instructions.

Three questions to ask of it. **Does every part of this trace back to a requirement?** Anything that doesn't is scope creep with good manners. **Is anything here more complicated than the requirement needs?** And **is there a decision in here I disagree with?**

That last one matters most. If you disagree, say so now and change it. A plan you didn't argue with is a plan you didn't read — and you'll discover what's in it during implementation, when changing it costs twenty times more.

## SUMMARY

Four things.

The plan is generated **against your project's captured stack**, which is why that screen mattered. **Four sub-artifacts** — research, data model, contracts, quickstart — and you use the ones your feature needs. The data model is the **business shape, not the schema**; naming and migrations come later. And a plan is an **argument to be read and argued with**, not a list to be followed.

## ACTION STEP

Generate the plan for your specification, then read it once with a pen.

Mark two things: anything that doesn't trace to a requirement, and anything you'd have done differently. Then decide on each — accept it and note why, or change it.

If you marked nothing at all, read it again. Nobody agrees with an entire plan on first reading.

## BRIDGE

You have an argument for how it gets built. Now we cut it into pieces small enough to finish.

---
---

# Lesson 5.5 — Tasks: Turning a Plan Into Checkable Work

**Type:** Demonstration · **Slot:** 12 minutes · **Narration target:** ~7.5 min plus screen action

**Learning objective:** Decompose a plan into discrete, individually checkable tasks that map back to specific requirements.

---

## HOOK

[SHOW ×L: title card — "Lesson 5.5 · Tasks That Can Actually Be Finished"]

A plan you can't check off is a plan you can't finish.

The difference between a project that visibly progresses and one that feels like it's been "nearly done" for three weeks is almost entirely in how the work was cut up. Not effort. Not skill. Task size.

## OBJECTIVE

In this lesson we're going to turn a plan into tasks, so that you can tell — at any moment, without guessing — how much of a feature is genuinely finished.

## BEAT 1 — What a task has to be

[SHOW: tasks.md with its checkboxes]

Tasks come out as a checklist. Unchecked boxes and checked boxes, and the proportion drives your progress everywhere else in the system.

Which means a task has to satisfy one hard rule: **it is either done or not done, and anybody can tell which.**

"Build the booking screen" fails that. Half a booking screen is a real state you can be in for days.

"Booking form validates that the selected slot is still free before submitting" passes. It works or it doesn't.

[PAUSE]

A rough size test: if a task will take you more than about half a day, it's probably two tasks wearing a coat. And if you can't say what proves it's done, it isn't a task yet — it's a heading.

## BEAT 2 — Every task points back at a requirement

[SHOW ×L: diagram — requirement to task to board]

Now the structural part.

Each task is linked to the specification it came from. That link is stored, not implied — the task knows which spec it belongs to.

That's what makes the chain we drew in the very first module actually hold. Scope constrains spec, spec constrains task, task constrains code. If a task exists that doesn't trace back to a requirement, one of two things is true: you found a missing requirement, or you're about to build something nobody asked for.

Both are worth knowing. Both are invisible without the link.

So when you review generated tasks, ask of each one: *which requirement is this serving?* If the answer is "none, but we'll need it" — stop, and go add the requirement. It takes two minutes and it keeps the chain intact.

## BEAT 3 — What updates itself

[SHOW: the lifecycle view and progress charts]

Something useful happens for free.

As tasks get checked off, the lifecycle tracking updates: progress for this spec, the phase view, and the project-wide lifecycle document with its charts and timeline.

Nobody writes a status report. The status *is* the checkboxes.

I'd draw one conclusion from that, and it's a behavioural one. Because progress is computed from tasks, the honesty of your entire project reporting depends on you only checking a box when the thing is actually done. Check things off optimistically and you'll build a dashboard that lies to you — cheerfully, in colour, with charts.

## BEAT 4 — Verify it landed in both places

[SHOW: terminal, then the board, showing the same spec]

Last thing, and it's the habit that closes this module.

Remember the pipeline writes to two places: your folder and the board.

So check both. Open your `specs/` folder and confirm the files are there — spec, plan, tasks, and the rest. Then open the project in the browser and confirm the spec exists with its tasks attached.

[PAUSE]

Ninety-nine times out of a hundred both are fine. The hundredth time, one is missing, and finding that now costs you a minute. Finding it in three weeks, when you're wondering why the board shows no work for a feature you've half built, costs you an afternoon and a certain amount of dignity.

Two places. Both true. Every time.

## SUMMARY

Four things.

A task is **done or not done, and anyone can tell** — more than half a day means split it. Every task **links back to a requirement**, and one that doesn't is either a missing requirement or unrequested work. **Progress computes itself** from your checkboxes, so only check what's truly done. And **verify both the folder and the board**.

## ACTION STEP

Review your generated tasks and do two passes.

First, find every task you couldn't prove was finished, and split it until you could.

Second, go down the list and name the requirement each one serves. Anything with no answer — decide right there whether to add the requirement or drop the task.

Then check your folder and your board. Both.

## BRIDGE

Specifications, a plan, and work cut small enough to finish. Next we deal with where all of it will actually live: your data.

---

*Generated by the lesson-scripter skill. Methodology sourced from the live createSpecs command prompt, including the disk/DB duality and the spec.md preflight rules.*
