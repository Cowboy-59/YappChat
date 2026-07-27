# Core Module 3A — Track A lesson scripts (build something new)

**Course:** wxKanban Spec-First · **Track A:** getting to an approved scope
**Lessons:** 3A.3, 3A.2, 4A.2, 3A.4 — presented in **Core Path order**
**Platform:** Windows

> **Production notes.**
>
> **1. Core order ≠ Full order — and these scripts must serve both.** In the Full course the sequence is 3A.1 → 3A.2 → 3A.3 → 3A.4, then 4A.1 → 4A.2. In the Core Path, 3A.1 is cut, so **3A.3 runs first** (it has to carry the scope structure that 3A.1 would have taught), then 3A.2, then 4A.2, then 3A.4 closes on hands-on work. Every script below is written **order-neutral**: none of them says "as you saw in the last lesson". Keep that discipline — one recording, two orders.
>
> **2. Narration is written to ~85% of the slot.** Adopted from the localization plan: dubbed audio runs 15–35% longer than English, and a dub over fixed video has nowhere to put the overflow. Leaving headroom now is free; retrofitting it across 72 lessons is not.
>
> **3. Capture markers are classified.** `[SHOW ×L:]` re-capture per language · `[SHOW ×L?:]` conditional · `[SHOW:]` universal. Terminal output is universal; anything a student reads is not.
>
> **4. This module is where the course stops being about tooling.** Module 2 was plumbing. From here the student is doing the actual intellectual work of the method, and the tone should shift accordingly — less "click here", more "here's how to think about this".

---
---

# Lesson 3A.3 — Writing Actors, Success Metrics, and Boundaries That Hold

**Type:** Worked example · **Slot:** 12 minutes · **Narration target:** ~10 min

**Learning objective:** Construct actor lists, measurable success metrics, and an explicit in-scope/out-of-scope boundary in the exact format the tooling expects.

---

## HOOK

[SHOW ×L: title card — "Lesson 3A.3 · Actors, Metrics, and Boundaries That Hold"]

Three parts of a scope document fail more often than everything else combined. And they're not the hard parts — they're the parts that look easy, so people write them in thirty seconds and move on.

Who it's for. What "done" means. And where it stops.

I'm going to show you a weak version and a strong version of each, side by side, using a real example. And I'll show you the exact format the tooling expects — because two of these three have a format that isn't optional, and getting it wrong causes a failure much later that gives you no clue where to look.

## OBJECTIVE

In this lesson we're going to write the three sections that fail most often — actors, success criteria, and scope boundary — so that yours pass the first time and a developer can build from them without asking a question.

## BEAT 1 — The example we'll work with

[SHOW ×L: the intent page from earlier — Delphine's booking app]

Let's use a real one rather than an abstraction.

Delphine is changing careers. She's building a booking app for a friend who runs a mobile dog-grooming business out of a van. Dog owners book a slot at their own address; the groomer sees her day as a route.

Small. Real. The kind of thing you can actually finish — which is exactly what a first project should be.

Now watch what happens when she writes the three sections quickly.

## BEAT 2 — Actors: the format is not optional

[SHOW ×L: two-column comparison — weak actors vs strong actors]

Here's Delphine's first attempt.

> *Users and admins.*

Two words. And it tells a developer nothing at all. Which users? Doing what? On what device? Is "admin" a real person in this business, or did she write it out of habit because software usually has admins?

Here's the strong version.

> **- Primary:** Dog owner — books and reschedules a grooming slot at their own address, almost always on a phone, usually in the evening.
> **- Secondary:** The groomer — one person, checks her round in the van each morning and marks jobs done.

[PAUSE]

Two things happened there.

First, the actors became **people doing things**, not roles in a dropdown. "Admin" vanished, because there is no admin — there's one groomer and she doesn't need an admin panel. That deletion alone probably saved a week.

Second — and this is the bit I want you to copy exactly — look at the line format. **A hyphen, the word Primary or Secondary, a colon.** That is not a stylistic preference. Later in this course you'll push your documents to the wxKanban board, and the tooling reads those exact lines to work out who the actors are. Write it as a prose sentence — "the primary actor is the dog owner" — and it doesn't get picked up. Nothing dramatic happens. It just quietly isn't there, and you find out weeks later.

So: `- Primary:` and `- Secondary:`, at the start of the line.

## BEAT 3 — Success criteria: if you can't count it, it isn't one

[SHOW ×L: two-column comparison — vague criteria vs measurable criteria]

Delphine's first attempt again.

> *The app is fast and easy to use. Bookings work reliably. The groomer is happy with it.*

Every one of those is a wish. Not one of them can be checked by anybody other than Delphine, on a day when she's feeling generous.

The strong version:

> 1. A returning dog owner completes a booking in under 90 seconds on a phone, from opening the app to seeing the confirmation.
> 2. The groomer's morning view loads her full day, in route order, in under 3 seconds on a mobile connection.
> 3. Zero double-bookings across 100 consecutive bookings in testing.

[PAUSE]

The test is simple, and I'd apply it to every criterion you ever write: **could someone who isn't you, and doesn't like you, verify this without asking you a question?**

"Easy to use" — no. "Under 90 seconds, returning user, on a phone" — yes. Somebody can sit down with a stopwatch and tell you that you failed.

That's the point. A success criterion you can't fail isn't a criterion, it's a mood.

And the validation tooling is looking for exactly this — it checks whether your criteria contain actual metrics: a time, a percentage, a count. Three of them, minimum.

## BEAT 4 — The boundary: name what you're not building

[SHOW ×L: in-scope / out-of-scope list for the booking app]

Now the section people skip hardest, because it feels like writing about nothing.

Here's the question that makes it work: **name three things someone might reasonably assume are included, that aren't.**

For Delphine:

> **Out of scope for v1:** taking payment in the app — the groomer takes cards in the van. Multiple groomers or staff accounts — there is one groomer. Automatic route optimisation — the app shows the day in the order the groomer sorted it; it doesn't compute a better order.

[PAUSE]

Look at that third one for a second, because it's the most valuable line on the page.

"Show the day as a route" and "work out the best route" sound almost identical when you say them out loud. One is a sorted list. The other is a genuinely hard optimisation problem that could eat a month. If Delphine hadn't written that line, at some point somebody — quite possibly Delphine herself at 11pm — would have assumed the second one.

That's what the boundary is for. It isn't documentation. It's the argument you're not going to have in week six, written down while it's cheap.

## BEAT 5 — The one that will get flagged

One more, quickly, because it's marked as a *critical* failure and it catches technical people specifically.

**No implementation details in the scope.** No frameworks, no languages, no library names, no API choices.

If your scope says "the booking form is a React component backed by a Postgres table", that's a critical failure — not a style note. The scope describes *what and why*. The plan, later, describes *how*. Mixing them means every technical decision gets locked in before anyone has thought about the requirement properly.

And it's experienced developers who trip this, every time, because you already know how you'd build it. Write what it must do. The how comes later, and it comes with reasons.

## SUMMARY

Three sections, three rules.

**Actors** are people doing specific things, on lines that start `- Primary:` and `- Secondary:` — a format the tooling actually reads. **Success criteria** contain a number somebody hostile could check. **The boundary** names at least three things a reasonable person would assume are in, that aren't.

And keep the technology out of all three.

## ACTION STEP

Take the intent page you wrote earlier and rewrite two parts of it.

Turn "who uses it" into proper actor lines, with the hyphen-Primary format. Then turn "what done looks like" into three criteria that each contain a number.

Fifteen minutes. You'll use both directly in the next stretch of work, so this isn't practice for its own sake.

## BRIDGE

That's the raw material. Now let's watch it get turned into a real scope document — and you'll see the tool push back harder than you expect.

---
---

# Lesson 3A.2 — Running buildscope: The Section-by-Section Interview

**Type:** Demonstration · **Slot:** 15 minutes · **Narration target:** ~11 min plus screen action

**Learning objective:** Execute a complete buildscope interview, answering each section in turn rather than dumping the whole idea at once.

---

## HOOK

[SHOW ×L: title card — "Lesson 3A.2 · Running buildscope"]

You're about to meet something that behaves less like a tool and more like a colleague who has read too many failed projects.

`buildscope` interviews you. And it is deliberately adversarial — it pushes back on vague answers, it asks what you're assuming, and it will not let you move to the next section until you've explicitly approved the current one.

The first time, that's uncomfortable. I'd ask you to sit with the discomfort, because every question it asks is one a developer would have asked you in week three, when answering it costs twenty times more.

## OBJECTIVE

In this lesson we're going to run a complete scope interview, so that you know what each phase is doing to your thinking and why answering properly matters more than answering fast.

## BEAT 1 — Before it asks you anything, it checks whether you need it

[SHOW ×L: the reuse check output]

Watch what happens first. Before a single question, it searches every scope that already exists and asks whether one of them already covers what you just described.

I want to explain why that's there, because it tells you something about the whole tool's attitude.

Building a scope is the most expensive operation in this entire workflow — a long interview plus a large generated document. So before spending that, it checks whether you're about to build something you already have. And it doesn't decide for you. It surfaces the match and offers you four ways out: reuse the existing one, extend it, look at it first, or proceed anyway because they're genuinely different.

[PAUSE]

That last option matters. If you take it, it asks you *how* they differ — and then carries your answer forward as the boundary against the existing scope. Your justification becomes part of the document. That's a nice piece of design: it doesn't block you, it just makes you say why.

## BEAT 2 — It starts from the problem, and puts your description aside

[SHOW ×L: the opening question on screen]

Now the part that surprises everyone.

You typed a description of what you want to build. The first thing it does is **set that aside** — explicitly — and ask you something else entirely:

> *What problem are we solving? Who has this problem, what does it cost them today, and why does it need solving now?*

Not what you want to build. What's broken.

[PAUSE]

And if you answer vaguely, it shows you the difference between a vague answer and a usable one. Something like: "users need a better way to track their time" is too broad. Compare that to — a consultant logs time at the end of the week by copying task names out of one system into a spreadsheet, misses entries, the project manager chases every Monday, and invoices go out three days late.

Same situation. One of them you can build from.

The reason this ordering matters is that everything downstream — the scenarios, the requirements, the success criteria — is traced back to the problem. If the problem is mush, everything built on it is mush, and no amount of careful requirement-writing rescues it.

## BEAT 3 — The interrogation, one question at a time

[SHOW: the interview running in the terminal]

Now it works through six areas, one question at a time, waiting for each answer.

The problem itself. Then whether existing code already does some of this. Then who the real users are — and it will reject "users" as an answer. Then the boundary, where it asks you to name three things people might assume are included. Then assumptions — *what are you assuming that you haven't said out loud?* And finally conflicts with scopes you already have.

Two of those are worth calling out.

**The assumption question** is the one people find hardest, and the tool knows it — if you say "nothing" it offers you a menu of the usual blind spots. Everyone has reliable internet. The other system's interface is always up. Only one person edits a record at a time. You read that list and something on it lands.

**The boundary question** is the one that saves the most money, for the reason we've already seen: it turns a fuzzy edge into a written exclusion.

## BEAT 4 — Section by section, and it waits

[SHOW ×L: a section review block with the A / C / E / Add options]

Once it has enough, it drafts — and then reviews with you one section at a time. Overview, scenarios, functional requirements, technical sections, success criteria, constraints.

For each one it shows you the draft, explains *why* it wrote it that way, asks you two or three pointed questions, and then stops. Approve, change, explain, or add.

It genuinely stops. It will not run ahead.

And if you approve something vague, it challenges you once — *are you sure? If a developer reads this cold, what's the first question they ask?* You can still approve it. But you have to do it twice, deliberately, which is a very effective way of making someone reconsider.

## BEAT 5 — The step people skip, and shouldn't

[SHOW ×L: the "revisiting your original description" block]

Here's my favourite part, and it's right at the end.

Before it writes anything, it goes back to the description you typed at the very beginning — the one it set aside — and asks whether it still says what you mean.

It almost never does.

[PAUSE]

You started with an idea. Then you spent forty minutes being asked hard questions about it. The thing you'd build now is sharper, narrower, and different from what you typed. The tool shows you both, tells you where they drifted apart, and makes you reconcile them.

Don't rush that screen. The gap between what you thought you wanted and what you now know you need is the single most valuable output of the whole exercise — and it's the thing you'd never notice on your own, because the drift happened one small step at a time.

Then it writes: the scope document, a requirements checklist alongside it, and any new domain terms into your project's glossary so the next scope uses the same words.

## SUMMARY

Four things you just watched.

It **checks whether the scope already exists** before spending an interview on it. It **starts from the problem**, not your feature description. It **reviews section by section and waits** for explicit approval, challenging vagueness once. And it **reconciles your original description** with what you actually built, at the end.

The one that changes outcomes most is the second. Anchor on the problem and the rest follows.

## ACTION STEP

Run it on the feature you rewrote actors and criteria for. Not the whole product — one feature.

Two rules while you do it. Don't reach for quick mode, even though it exists — the interview *is* the value; skipping it gets you a document with none of the thinking in it. And when it asks the problem question, give it the long answer. Who, what breaks today, what that costs.

Budget forty minutes and don't do it late at night. This is thinking work.

## BRIDGE

You'll come out with a document that feels finished. Next we find out whether it actually is — because "feels finished" and "passes" are different things.

---
---

# Lesson 4A.2 — Running validatescope and Reading the Findings

**Type:** Demonstration · **Slot:** 12 minutes · **Narration target:** ~9 min plus screen action

**Learning objective:** Execute validatescope and interpret each finding as either a real gap or an accepted trade-off.

---

## HOOK

[SHOW ×L: title card — "Lesson 4A.2 · Validate and Read the Findings"]

Your scope document is going to come back with a grade. An actual letter grade, A+ down to F.

And I want to set your expectations before you see yours, because a first scope commonly lands at a B — and a B looks like failure if you weren't expecting it, when it's actually completely normal.

More importantly: the grade is not the point. What matters is being able to read each finding and decide whether it's a real gap you should fix, or a trade-off you're making on purpose. Those need different responses, and the tool can't tell them apart. You can.

## OBJECTIVE

In this lesson we're going to validate a scope and read its findings, so that you can tell a genuine defect from an accepted trade-off and act on each correctly.

## BEAT 1 — What it actually checks

[SHOW: validation report, section headers visible]

Four groups of checks.

**Structure and completeness** — are the required sections there? Three scenarios minimum, three requirements, three success criteria, constraints, a status.

**Content quality** — this is the interesting group. Are the requirements testable? Do the success criteria contain real metrics? Are actors identified? And the one marked critical: no implementation details.

**Formatting and standards** — sequential numbering with no gaps, proper tables, no leftover placeholder markers.

**Pipeline readiness** — no unresolved clarification markers, dependencies listed, and it can actually be broken down into specs.

Then it scores: passed over total, as a percentage, with a grade. Ninety-five and up is ready. Eighty-five and up is ready with notes. Seventy-five to eighty-four is a B — needs refinement.

## BEAT 2 — Reading a real result

[SHOW: a B-grade report with three findings visible]

Here's Delphine's, at 78%. A B. Three things failed. Let's take them one at a time, because they need three different responses.

**Finding one: only two success criteria found, three required.** That's a real gap and a two-minute fix. She wrote a booking-speed criterion and a load-time criterion, and never wrote one for the thing that actually matters most — that the app never double-books. Fix it, properly.

**Finding two: success criterion 1 is not measurable.** She'd written "booking is quick and painless." Also a real gap, also a quick fix — and note this is the exact failure from earlier: a criterion nobody hostile could check.

**Finding three: implementation details found in functional requirements.** She'd written that reminders go out "via the SMS provider's API". That's critical severity — and it's the interesting one, because Delphine has a genuine reason: the groomer already pays for a specific SMS service and isn't changing it.

[PAUSE]

So which is it — defect or trade-off?

It's a trade-off, but the *placement* is still wrong. The requirement should say what must happen: a reminder reaches the customer by text message the evening before. The fact that it must use that specific existing service is a **constraint**, and there's a constraints section for exactly that. Move it, don't delete it.

That's the skill this lesson is really about. The tool told her something was in the wrong place. It couldn't tell her where it belonged. That judgement is yours, and it's the difference between using the score and being ruled by it.

## BEAT 3 — What auto-fix will and won't touch

[SHOW: terminal, running validation with the fix flag]

There's a fix flag, and it's more limited than it sounds — deliberately.

It renumbers requirements that have gaps. It adds a missing status field. It standardises headers, trims whitespace, aligns tables.

It will **not** touch content. It won't write your missing success criterion, won't make a vague requirement testable, won't decide that your SMS line belongs in constraints. Formatting only, never meaning.

That restraint is correct, and worth understanding rather than resenting: a tool that "fixed" your requirements by rewriting them would be inventing content you never approved — which is the entire problem this method exists to prevent.

So run it for the tidying. Do the thinking yourself.

## BEAT 4 — Batch mode, once you have a few

[SHOW: batch report table across several scopes]

One more, for later.

Once you have several scopes, you can validate all of them at once and get a table — every scope, its score, its grade — plus something genuinely useful: the top issues *across* all your scopes.

That last part is a mirror. If the same failure appears in six documents, that's not six mistakes, it's one habit. Mine used to be un-measurable success criteria, in everything, for months. The batch report is what showed me.

You don't need this today. Remember it exists for when you have five or six scopes.

## SUMMARY

Four takeaways.

It checks **structure, content quality, formatting, and pipeline readiness**, then grades. A first scope at **B is normal**, not failure. Every finding is either a **real gap or a misplaced trade-off** — and only you can tell which. And **auto-fix touches formatting, never content**, on purpose.

Fix the gaps. Relocate the trade-offs. Write down anything you're accepting deliberately, so that six weeks from now you know it was a decision and not an oversight.

## ACTION STEP

Validate your own scope and read every finding out loud — genuinely out loud, it makes vagueness obvious.

For each one, write a single word next to it: **fix**, **move**, or **accept**. Then do the fixes and the moves, and for anything marked accept, add one line to your constraints saying what you accepted and why.

Then run it again and watch the grade move.

## BRIDGE

That's the loop: draft, validate, decide, revise. Now it's your turn to run it end to end on something of your own.

---
---

# Lesson 3A.4 — PRACTICE: Scope Your Own Feature

**Type:** Practice · **Slot:** 6 minutes narration plus student work

**Learning objective:** Produce a complete, validated scope document for one feature of your own project.

---

## HOOK

[SHOW ×L: title card — "Lesson 3A.4 · PRACTICE: Scope Your Own Feature"]

Everything up to now has been watching. This is the one where you produce the first real artifact of your project.

Set aside a proper block of time — this is an hour, not ten minutes, and it's the most valuable hour in the course.

## OBJECTIVE

In this lesson you're going to produce a validated scope document for one feature of your own project, from interview through to a passing grade.

## BEAT 1 — What you're producing

One scope document. One feature. Validated to at least a B, with every finding either fixed, moved, or explicitly accepted in writing.

**One feature.** Not your whole product. If you scope the entire application in one document you'll get something enormous, vague, and impossible to build from. Pick the single feature that, if it didn't exist, would make the rest pointless.

For Delphine that's booking a slot. Not the route view, not reminders — the booking itself.

## BEAT 2 — The rules

**Don't use quick mode.** It's there, it skips the interview, and it will give you a document with none of the thinking in it. The interview is the product.

**Answer the problem question at full length.** Who has the problem, what they do today instead, what that costs them. If your answer is under three sentences, it's not finished.

**When it challenges you, take the challenge seriously.** If it asks whether you're sure about a vague requirement, the honest answer is usually no.

**Expect to change your description at the end.** That's the tool working, not you having wasted the first forty minutes.

## BEAT 3 — Starting the hardest answer

The problem question stops people. So here's the first one, done.

Weak: *"The groomer needs a better booking system."*

Strong: *"Customers text or ring the groomer while she's working, often with both hands on a dog. She writes appointments on a paper diary in the van at the end of the day, from memory. Twice this month she double-booked a Saturday morning and had to ring someone back and cancel — one of them didn't rebook. She loses roughly two hours a week to booking admin and about one customer a month to mistakes."*

[PAUSE]

Who, what breaks, what it costs. Three parts, and every one of them concrete.

Now pause, and go and do it. Come back when you have a validated scope.

[PAUSE — "Pause here. Take an hour. Come back with a scope."]

## BEAT 4 — What good looks like

Welcome back.

Four signs it went well, and most of them are slightly uncomfortable.

**Your final description doesn't match what you typed at the start.** Good. That gap is the thinking.

**Your out-of-scope list has at least three real entries** — things you genuinely considered and deliberately excluded, not filler.

**Something surprised you during the assumption question.** Almost everyone finds at least one thing they'd been quietly assuming.

**Your grade isn't an A+, and you know exactly why.** Knowing *why* your document is at 85% beats a 95% you don't understand.

If you got all four, you have something a developer could genuinely build from. That's a different object from anything a chat window produces.

## ACTION STEP

The practice is the action step, so just this: save it, and read it once more tomorrow morning.

Not tonight — tomorrow. You'll spot at least one thing that reads fine now and won't then. That's a genuine effect, and it costs you five minutes.

## BRIDGE

You have an approved scope. Next it becomes something a developer can work from, one file at a time.

---

*Generated by the lesson-scripter skill. Methodology sourced from the live buildscope and validatescope command prompts, not reconstructed from memory.*
