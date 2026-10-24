# Core Module 6 — Ship It

**Course:** wxKanban Spec-First · **Module:** QA through release
**Lessons:** 8.2, 8.3, 8.6, 10.3, 10.5, 10.6 — **Core Path order**
**Platform:** Windows

> **Production notes.**
>
> **1. This module closes the Core Path.** 10.6 is the last lesson a Core student sees, and it carries a specific obligation from the Core Path audit: it must **name the human-testing gap out loud**. A Core student can finish, release an application, and never have had another person touch it. That's the most defensible cut on production cost and the least defensible on quality, and the honest handoff is what converts it into the reason to start the Full course. Do not cut that beat.
>
> **2. Deployment is deliberately generic.** The kit does not own your infrastructure — every project deploys differently. Lesson 10.3 teaches the three things that are true regardless of target, and explicitly refuses to pretend there's one command. Substituting your own project's deploy demo here is fine and good; the principles are what must survive.
>
> **3. In the Full course these are two modules** (M8 QA, M10 Beta/Release) with human testing between them. Nothing in these scripts assumes they're adjacent, so both groupings read correctly.
>
> **4. Slots are recorded, not re-baselined.** The consolidated re-baseline runs after this module, covering all 35 Core lessons at once.

---
---

# Lesson 8.2 — Building the Test Plan From the Spec

**Type:** Demonstration · **Slot:** 13 minutes

**Learning objective:** Construct a test plan in which every case maps to a numbered requirement in the spec.

---

## HOOK

[SHOW ×L: title card — "Lesson 8.2 · A Test Plan You Can Trace"]

Most test suites answer the question "does the code do what the code does?"

That sounds like a joke. It isn't. Tests written by reading the implementation will faithfully confirm whatever the implementation happens to do, including the parts that are wrong — because the same understanding produced both.

What we want is a test plan derived from **the requirements**, so that when a test fails you know something is wrong with the *code*, and when the plan is complete you know something specific: that every requirement has been checked.

## OBJECTIVE

In this lesson we're going to build a test plan from a specification, so that every test traces to a numbered requirement and coverage means something you can prove.

## BEAT 1 — Point it at the spec, not the code

[SHOW: invoking the test plan against a spec number]

You can point the planner at a whole application, or at a path. What you want here is the third option: **point it at a spec**.

It reads that spec's numbered functional requirements and derives test coverage from them. So `FR-003` gets tests that exist to prove `FR-003`.

[PAUSE]

That inversion is the whole lesson. Coverage stops meaning "what percentage of lines were executed" and starts meaning "which requirements have been checked". Those are wildly different numbers, and only one of them tells you whether you can ship.

You can have ninety percent line coverage and an untested requirement. You can have modest line coverage and every requirement proven. The second is the one that lets you sleep.

## BEAT 2 — Inventory first, and why that isn't optional

[SHOW: the inventory output — routes, services, tables, screens]

Before writing a single test, it inventories every callable unit: routes, services, database tables, and the screens and flows.

It would be quicker to skip that and start writing tests for the obvious things. That's exactly why it doesn't.

The inventory exists to make **absence visible**. Without it, you write tests for the parts you're thinking about, and the parts you forgot are indistinguishable from the parts that don't exist. With it, there's a list — and anything on the list with no test against it is a gap you can see rather than a gap you'll meet later.

Same principle as `_discarded.md` back in conversion. Same principle as the open questions section. **Make the missing thing visible.** If there's one idea running through this entire course, that's it.

## BEAT 3 — Two experts, not one

[SHOW ×L: the two review lenses]

The planning runs two distinct perspectives, and the second one surprises people.

A **QA architect** derives functional coverage from the requirements — the work you'd expect.

A **database engineer** looks somewhere nobody else does: referential integrity, scored rather than hand-waved; orphaned tables and orphaned data; missing indexes, and *excessive* ones.

That last pair is worth pausing on. A missing index is a performance problem you'll eventually notice. An excessive index is one nobody ever notices — it silently taxes every write, forever, and no test will ever fail because of it.

And orphaned data is the one that quietly corrupts trust in a system: rows pointing at things that no longer exist, appearing in reports, adding up to totals that are wrong in ways nobody can trace.

Neither of those is something a functional test suite is shaped to find. That's why there are two lenses.

## BEAT 4 — Approve the shape before the detail

[SHOW ×L: the coverage summary awaiting approval]

One more piece of design worth understanding, because it's a pattern you've now seen three times.

The plan is produced in two gated stages. First a **coverage summary** — what areas will be tested, at what depth, with no individual test bodies. You approve that. Only then does it expand into atomic test items.

Why: reviewing four hundred generated test items is not a thing a human does properly. Reviewing a one-page summary of what will be covered is. You catch a missing area at the point where fixing it is one line rather than a hundred.

Same shape as the section-by-section scope review, and the specify-before-plan ordering. **Approve structure before detail.** It's the same idea every time, and it works because human review has a size limit.

## SUMMARY

Four things.

Derive tests from **requirements, not code** — coverage means requirements checked, not lines executed. **Inventory first**, so absence is visible rather than invisible. **Two lenses** — functional and database, because integrity and index problems don't fail functional tests. And **approve the coverage shape before the detail is generated**.

## ACTION STEP

Build the test plan for the spec you implemented, and stop at the coverage summary.

Read it against your requirements list and ask one question: **is any requirement missing from this?** If one is, say so before approving. That's the entire purpose of that gate, and it's the last cheap moment to use it.

## BRIDGE

A plan proves nothing on its own. Next we run it.

---
---

# Lesson 8.3 — Running QA and Recording Results

**Type:** Demonstration · **Slot:** 12 minutes

**Learning objective:** Execute a test run and record pass, fail, and blocked outcomes against the plan.

---

## HOOK

[SHOW ×L: title card — "Lesson 8.3 · Running the Gates"]

Running the plan happens in three gates, and they get progressively more real.

The thing I most want you to notice is what happens at the third one — because the tool refuses to do something, and that refusal is the most important design decision in this whole stage.

## OBJECTIVE

In this lesson we're going to execute a test plan through its three gates, so that you know what each one proves and who is responsible for the final answer.

## BEAT 1 — Gate one: does it stand up

[SHOW: smoke gate running]

The first gate is smoke. Everything gets touched, read-only or mocked, and the only question is: does it respond without falling over?

Deliberately shallow. It isn't checking whether anything is *correct* — it's checking whether anything is *catastrophically* broken, and it runs fast enough to be worth doing constantly.

Think of it as a pulse check. It doesn't tell you the patient is well. It tells you whether it's worth running the other tests.

## BEAT 2 — Gate two: does it actually work

[SHOW ×L: the CRUD round-trip and its constraint]

Second gate is where reality arrives. A genuine round trip — create a record, read it back, update it, delete it — plus real execution of real behaviour. No mocks.

And a hard constraint attached: **against a non-production database only.**

[PAUSE]

That's not a suggestion, and it isn't there because someone was being cautious. This gate deliberately creates, modifies and destroys data. Point it at production and it will do exactly what it was built to do, competently, to your customers' records.

So: know which database you're pointed at. Check before you run, not after. This is one of a very small number of places in this course where a mistake is not recoverable.

What this gate proves is the thing smoke can't — that the feature works end to end, in the real shape, against a real database.

## BEAT 3 — Gate three: the machine stops

[SHOW ×L: final signoff — evidence presented, awaiting human]

Third gate. And here's the part I flagged at the start.

The tool gathers everything — what ran, what passed, what failed, what's outstanding — presents it as evidence, and then **stops**. It will not sign off. A person does that.

That's not a missing feature. It's the correct design, and it's worth understanding why rather than resenting the extra step.

[PAUSE]

Automated tests answer "does the software do what the tests say it should?" Only a human can answer "and are the tests asking for the right things?" A tool that signed itself off would be marking its own homework using a mark scheme it also wrote.

So the final gate is you, reading the evidence, and deciding. When you sign it off, you're saying something specific and it has your name on it: *I have looked at this and I believe it does what we specified.*

Which means read it properly. Signing off a test report you skimmed is worse than having no gate at all, because now there's a record saying somebody checked.

## BEAT 4 — Recording outcomes honestly

[SHOW: results being recorded — pass, fail, blocked]

Each item ends as passed, failed, or blocked, recorded against the plan — and the record lives in the system, not in a local file that only you have.

**Blocked** matters again here, same as in implementation. A test that couldn't run is not a test that passed. Recording it honestly is what stops a coverage number from becoming a comfortable fiction.

And one habit: when something fails, resist fixing it immediately. Finish the run first, then look at the failures together. Fixing as you go means you never see the shape — and three failures with one shared cause look very different from three unrelated ones.

## SUMMARY

Three gates. **Smoke** — does it stand up, shallow and fast. **CRUD and execute** — does it really work, against a non-production database, and check which database before you run. **Final signoff** — the tool presents evidence and stops, because only a person can judge whether the tests asked the right questions. Record **pass, fail, or blocked** honestly; blocked is not passed.

## ACTION STEP

Run the smoke gate on your own spec, then read what it gives you before going further.

And do one thing before the CRUD gate: say out loud which database you're pointed at, and check it. Every experienced person who has made this mistake made it while certain they hadn't.

## BRIDGE

You've proven it works. Now take one all the way through.

---
---

# Lesson 8.6 — PRACTICE: Take One Spec Through the QA Gate

**Type:** Practice · **Slot:** 6 minutes narration plus student work

**Learning objective:** Produce a completed test run and a filed report for one spec of your own.

---

## HOOK

[SHOW ×L: title card — "Lesson 8.6 · PRACTICE: Through the Gate"]

One spec, all three gates, and your name on the signoff at the end.

## OBJECTIVE

In this lesson you're going to take one spec through the full QA sequence and sign it off deliberately.

## BEAT 1 — What you're producing

A completed test run against one spec, with every item recorded, and a signoff you can defend.

Use the spec you implemented. The point is the loop, not volume.

## BEAT 2 — The rules

**Check your database before the CRUD gate.** Out loud. Every time.

**Finish the run before fixing anything.** Failures are more informative in a group.

**Record blocked as blocked.** A test that couldn't run has not passed.

**Read the evidence before signing.** If you're going to skim it, don't sign it — an unsigned report is honest, a rubber-stamped one is a lie with a name on it.

## BEAT 3 — What to expect

Two predictions.

**Something will fail, and it will probably be a requirement you thought was simple.** That's the normal outcome and it's the system paying for itself.

**At least one test will make you re-read the requirement** and realise the requirement was ambiguous — not the code. That's a spec fix, not a code fix, and it goes back to the document.

[PAUSE]

Now pause and run it. Come back when you've signed something off.

[PAUSE — "Pause here. Three gates. Then come back."]

## BEAT 4 — What good looks like

Three signs.

**You found at least one real defect.** A run that finds nothing usually means the tests were derived from the code rather than the requirements.

**You fixed at least one requirement, not just code.** That's the loop closing properly.

**You hesitated before signing off.** Good. That hesitation is what the gate is for.

## ACTION STEP

The practice is the action step. Note one thing in your project notes: the requirement that broke, and whether the fault was in the code or in the wording.

Over a few specs that becomes genuinely useful self-knowledge about where your own specifications go soft.

## BRIDGE

Proven. Now get it in front of someone.

---
---

# Lesson 10.3 — Deploying the Build

**Type:** Demonstration · **Slot:** 14 minutes

**Learning objective:** Deploy a built application and verify the deployment from outside your own machine.

---

## HOOK

[SHOW ×L: title card — "Lesson 10.3 · Deploying the Build"]

I'm going to be straight with you: I can't show you *the* deployment command, because there isn't one.

Deployment is the one part of this whole course that is genuinely different for every project. A cloud container, a shared host, a customer's own server, an app store. The kit does not own your infrastructure and doesn't pretend to.

What I can give you is the three things that are true regardless of where you're deploying — and the one verification step that people skip and regret.

## OBJECTIVE

In this lesson we're going to cover what's universally true about deploying, so that whatever your target is, you deploy the right thing and know it worked.

## BEAT 1 — Deploy an artifact, not a working directory

[SHOW ×L: build artifact vs working tree]

First principle. You deploy a **built artifact** — a package, an image, a bundle. Not the folder you've been working in.

The reason is repeatability. Your working directory contains things that aren't in version control, half-finished edits, and local configuration. It works on your machine partly by accident, and nobody — including you — can say exactly which accident.

A build takes what's committed and produces something deterministic. Same input, same output. When it breaks, the question "what's actually deployed?" has an answer.

[PAUSE]

If you're coming from a world where deployment meant copying files onto a server, this is the biggest shift, and it's worth making. "It works on mine" is a symptom of deploying working directories.

## BEAT 2 — Deploy the thing you tested

Second principle, and it sounds too obvious to say until you've watched it go wrong.

The artifact you deploy must be built from **the same commit you tested**. Not "the same code, plus a small fix I made after". That small fix is untested, and it's now in production.

The rhythm is: build, test that build, deploy that build. If something needs fixing, you go round the loop again. You don't patch the thing in flight, however small and however late it is.

Late-day patches applied straight to production are the origin of a remarkable proportion of all outages, and the reason is always the same — the tested thing and the shipped thing were not the same thing.

## BEAT 3 — Configuration is not code, and it's where it breaks

[SHOW ×L: config and secrets as separate from the artifact]

Third principle. Your artifact should be identical everywhere; what differs is **configuration** — database connections, keys, endpoints, secrets.

Which makes configuration the most common deployment failure by a wide margin. The build is fine. The code is fine. It's pointed at the wrong database, or a secret that exists in one environment and not the other.

Two habits. **Keep a list of every configuration value your application needs**, and check it against the target before deploying — a missing value usually fails at the worst possible moment, which is after it's started serving traffic. And **never put secrets in the artifact**. An artifact is a file; files get copied, shared, and kept.

## BEAT 4 — Verify from somewhere that isn't your machine

[SHOW: checking the deployed app from a phone]

Now the step people skip.

When it's deployed, you check it — and you check it from a device that is not the machine you deployed from. Ideally your phone, off wifi.

[PAUSE]

Why: your machine has caches, a session already logged in, sometimes a hosts entry or a VPN route you set up months ago and forgot. It is the single least reliable place from which to judge whether a deployment worked, and it's where everyone checks.

The full version of the check is: load it on a device that has never seen it, on a network that isn't yours, logged out. That catches the classic embarrassment — the deployment that works perfectly for exactly one person on earth.

## SUMMARY

Three principles and a check.

Deploy a **built artifact**, not a working directory. Deploy the **same build you tested** — no patches in flight. Keep **configuration separate**, checked against the target, with no secrets in the artifact. And **verify from a device and network that aren't yours.**

## ACTION STEP

Whatever your target is, write down your deployment as a numbered list of steps, then do it once from that list.

If a step turns out to be "and then I fiddle with it until it works", that's the step to fix first. It's the one that will fail at the worst time, probably while somebody is waiting.

## BRIDGE

It's running. Now make it official.

---
---

# Lesson 10.5 — Finalizing the Release and the Release Record

**Type:** Demonstration · **Slot:** 11 minutes

**Learning objective:** Execute the release finalization and complete the release record with version, method, date, and notes.

---

## HOOK

[SHOW ×L: title card — "Lesson 10.5 · Making It Official"]

The release step will refuse to run.

Not might — will, if anything is outstanding. And rather than treat that as an obstacle, I want to show you exactly what it checks, because the checklist is a good description of what "finished" actually means.

## OBJECTIVE

In this lesson we're going to finalize a release, so that you know what blocks it, why, and what the release record is for.

## BEAT 1 — What blocks a release

[SHOW ×L: the five phase statuses and the blockers]

It reads the lifecycle record and checks that all five prior phases are complete: design, implementation, QA, human testing, and beta. Any one of them not complete, and it halts and tells you which.

Then it checks something subtler. **Every feedback item must have a resolution**, and every beta item too, and any modification made during beta must have been approved or rejected.

[PAUSE]

Notice what "resolved" means here, because it's more generous than people expect: **accepted, rejected, or deferred.**

Deferring is a legitimate resolution. You're allowed to look at a piece of feedback and decide it isn't for this release. What you're not allowed to do is leave it *unanswered* — sitting there, neither in nor out, so that in four months nobody can tell whether it was considered or forgotten.

That's the whole philosophy in one rule. The system almost never insists on a particular decision. It insists that a decision was made.

## BEAT 2 — The record, and what it's actually for

[SHOW: the lifecycle record showing the full journey]

The release phase is the only one that writes the final "all phases complete" state, and the lifecycle record becomes the **permanent history of that feature's journey** through all six phases — when it entered each one, when it left, and why it moved.

Here's what that's worth. Eighteen months from now, someone asks why the booking screen behaves the way it does. Today, that question has no answer beyond whoever still remembers. With this, there's a trail: the scope that framed the problem, the spec that defined behaviour, the tasks, the test results, the feedback and how it was resolved.

That's not bureaucracy. That's the difference between a product a business can rely on and a personal project other people happen to use.

## BEAT 3 — Release notes worth reading

Release notes get generated from what actually happened — the requirements delivered, the feedback resolved.

Edit them anyway, for one specific audience: **the person using this**, not the person who built it.

"Implemented FR-004" means nothing to a customer. "You can now rebook an appointment without cancelling it first" means everything.

The generated version is your raw material and it's accurate. Your job is the translation from what you built into what changed for them.

## BEAT 4 — The version number

[SHOW: version, method, date recorded]

Finally, record the version, the deployment method, and the date.

One piece of advice on version numbers: pick a scheme now and never think about it again. Whatever you choose, the only property that matters is that **someone can tell you which version they're running, and you can tell what's in it.**

Most arguments about versioning schemes are, in practice, arguments about nothing. Consistency is the whole value.

## SUMMARY

Release **blocks until all five prior phases are complete** and every feedback item is resolved — where resolved means **accepted, rejected, or deferred**, and deferring is a real answer. The lifecycle record is the **permanent history** of the feature's journey, and it's what answers "why does this work this way?" in eighteen months. **Write release notes for the user, not the builder.** And **record version, method, and date** consistently.

## ACTION STEP

Run the finalization even if you expect it to block — especially then.

Read what it says is outstanding. That list is a precise, honest description of the distance between where you are and what "released" means. Most people have never seen that written down.

## BRIDGE

One thing left: do it, on your own project, for real.

---
---

# Lesson 10.6 — PRACTICE: Cut Your First Release

**Type:** Practice · **Slot:** 11 minutes narration plus student work

**Learning objective:** Produce a finalized release of your own application with a complete release record.

---

## HOOK

[SHOW ×L: title card — "Lesson 10.6 · PRACTICE: Cut Your First Release"]

Last one. You're going to release something.

Not a demo, not a branch — a version, with a number, a record, and a date. Something you could hand to a small business.

## OBJECTIVE

In this lesson you're going to take your own application through finalization and produce a complete release record.

## BEAT 1 — What you're producing

A released version of your own application: deployed, verified from a device that isn't yours, finalized, with version, method, date and notes recorded.

If earlier phases block you — and they may — resolving those blocks *is* the exercise. That's the real work of releasing, and finding out what it takes is the point.

## BEAT 2 — The rules

**Resolve every outstanding item honestly.** Accepted, rejected, or deferred — with deferred meaning you decided, not that you ran out of energy.

**Verify from your phone, off wifi, logged out.** Before you finalize, not after.

**Write the notes for a user.** Read them back and ask whether someone who doesn't know your codebase would understand what changed.

**Don't skip a phase to make it pass.** If it blocks, that's information. Marking something complete to get past a gate is the one move that makes this entire method worthless.

## BEAT 3 — Before you start

Open your lifecycle record and look at the five phase statuses.

Whatever isn't complete is your work list for today, in order. If human testing is the gap — and for many of you it will be — that's the next beat, and it's the most important thing I'll say in this lesson.

[PAUSE]

Go and cut your release. Come back when you have a version number.

[PAUSE — "Pause here. Release it. Then come back."]

## BEAT 4 — What you've done, and what you haven't

Welcome back. Take a second with this, because it's genuinely an achievement: you took something from an idea, or from a legacy application, all the way to a released version with a written record of every decision. Most people who set out to do that never get there.

Now the honest part, and I'd rather say it than let you find out.

**You have shipped, and it is entirely possible that no other human being has used this.**

[PAUSE]

Everything in this path proved that your software does what your specification said. Not one thing proved that your specification said the right thing. Those are different questions, and only one of them has been answered.

That's the human testing phase — real people, doing real work, telling you what's wrong. It's the phase this shorter path skips, and it's the one that finds the things you cannot find alone, because you know too much about how it's meant to work.

So here's my honest recommendation for what to do next. Before you put this in front of a paying customer, get **one person who is not you** to use it for twenty minutes while you watch and say nothing. Nothing else you can do in the next hour will teach you as much.

And if you want the structured version of that — how to run a proper round, how to triage what comes back into bugs, change requests and new specs, and how to close the loop without restarting your project — that's what the full course covers, along with the deeper material on scope validation, gate mechanics, compliance passes, and the capstone.

You now have the loop. Everything else is more of it, done better.

## ACTION STEP

Two things.

**Record your version number and today's date** somewhere you'll see it again. That's your baseline; every future release is measured from it.

**Arrange the twenty minutes.** Actually arrange it — a name and a time, today. It's the single highest-value hour available to you right now, and it's the one everybody intends to do and doesn't.

## BRIDGE

That's the whole loop: scope, spec, task, code, test, release — with a record of every decision. You can run it again tomorrow on something bigger, and it will work the same way.

---

*Generated by the lesson-scripter skill. Sources: the shipped wxCreateTestPlan skill (three signoff gates, dual-persona planning) and the wxAI-release command (phase blockers, resolution states, lifecycle record).*
