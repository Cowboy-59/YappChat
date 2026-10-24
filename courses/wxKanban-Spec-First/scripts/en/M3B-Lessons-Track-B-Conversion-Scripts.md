# Core Module 3B — Track B lesson scripts (convert a legacy app)

**Course:** wxKanban Spec-First · **Track B:** getting to an approved scope from a legacy application
**Lessons:** 3B.3, 3B.4, 3B.5, 4B.2, 4B.5 — presented in **Core Path order**
**Platform:** Windows

> **Production notes.**
>
> **1. Core order ≠ Full order.** In the Full course this runs 3B.1 → 3B.6 then 4B.1 → 4B.5. In the Core Path, 3B.1, 3B.2, 3B.6, 4B.1, 4B.3 and 4B.4 are cut, so **3B.3 opens the module** and has to carry what 3B.1 and 3B.2 would have said — why legacy source never goes to an AI directly, and which of the three converters applies. That's built into its first ninety seconds, per the Core Path audit. Every script is order-neutral; none says "as you saw last lesson".
>
> **2. Narration at ~85% of slot or below**, for dub headroom. Worked-example lessons sit nearer the top of that range than demonstrations, because they have less on-screen action to absorb the gap — that was the lesson learned from 3A.3.
>
> **3. WINDEV is the worked platform; VB6 and Clarion are named, not demonstrated.** Demonstrating all three would triple the recording for an audience that is mostly PCSoft. The scripts name the equivalent inputs for the other two so nobody feels excluded, and the workflow after conversion is identical.
>
> **4. Do not over-promise fidelity.** This module's honesty is its value. A converted app is a *scaffold plus an inventory*, not a working replacement, and every script says so plainly. Overselling here produces students who trust output they should be auditing.

---
---

# Lesson 3B.3 — Running the Conversion: From Source to Readable Markdown

**Type:** Demonstration · **Slot:** 15 minutes · **Narration target:** ~11 min

**Learning objective:** Execute the stage-one conversion for your platform and locate the artifacts it produces under `pre-convert/`.

---

## HOOK

[SHOW ×L: title card — "Lesson 3B.3 · From Legacy App to Readable Markdown"]

I'm going to ask you to do something that will feel wrong.

We are not going to give the AI your source code. Not the windows, not the classes, not the project. None of it.

[PAUSE]

If you've spent twenty years in WINDEV, that sounds like throwing away the only thing that actually knows what the application does. Stay with me for two minutes, because the reason is the difference between a conversion you can trust and one you can't.

## OBJECTIVE

In this lesson we're going to run the first conversion pass on a legacy application, so that you end up with readable, per-element Markdown you can actually check — and so you know exactly what to look at to find out what *didn't* come through.

## BEAT 1 — Three doors, and the one input that matters

Quickly, so nobody's in the wrong lesson.

There are three conversion paths. **WINDEV and WEBDEV** — the input is the project's generated **Technical Documentation PDF**. **Visual Basic 6** — the input is the project source: the `.vbp`, `.frm`, `.bas` and `.cls` files. **Clarion** — the input is the exported `TXA` and `TXD` files plus `.clw` source.

I'll demonstrate the WINDEV path because that's where most of you are. If you're on VB6 or Clarion, the inputs differ and everything after this lesson is identical.

Now — why documentation rather than source, for WINDEV?

Because the technical documentation export is a **complete, structured description of every element in your project**, written by the tool that knows it best. Every window, every field, every query, every procedure, in a consistent shape. Your source is thousands of files, much of it generated, in a language whose meaning depends on context an AI reading a single file doesn't have.

One is an inventory. The other is a haystack.

[PAUSE]

And here's the part that should reassure you most: the heavy lifting is not done by an AI at all. The splitting and regeneration run in **deterministic Python scripts**. Same input, same output, every time. It cannot get creative with your stock module, because nothing in that step is guessing.

## BEAT 2 — Generating the input, and splitting it

[SHOW ×L?: WINDEV generating the technical documentation export]

So the first move happens in WINDEV, not here: generate the technical documentation for the project and export it as PDF.

[SHOW: terminal, running the doc split]

Then we split it. One PDF in — a directory of per-element Markdown out, under `pre-convert/`. One file per window, per query, per procedure set, per report.

And this is already worth something on its own, before any rebuild. Open one.

[SHOW: a per-element Markdown file open in the editor]

That's a window you wrote years ago, described in plain readable text — its fields, its properties, its behaviour. No PCSoft licence needed to read it. That alone is the best documentation most legacy applications have ever had.

## BEAT 3 — The detail that decides whether you lose half your application

[SHOW ×L: diagram — breadcrumb Type vs Part number]

Now I want to tell you about a real bug, because the lesson in it is bigger than the bug.

The splitter has to work out what each page of that PDF *is* — a window, a query, a procedure set. The obvious way is the part number: Part 4 is queries, Part 5 is procedures, and so on.

That is exactly what it used to do, and it was wrong. **PCSoft part numbering isn't stable between exports.** Queries might be Part 4 in one export and Part 6 in another. Procedure sets might be 5, or 7.

So on some projects it silently dropped whole sections. Not some queries — *all* the real queries. And the entire server and global procedure layer, including the HFSQL trigger procedures.

[PAUSE]

Think about what that means for a moment. The conversion completes. No error. You get pages, you get a schema, everything looks fine — and the entire backend business-logic layer of your application simply isn't there. And you would not know.

It now classifies on the breadcrumb **Type** instead, which is stable. The bug is fixed.

I'm telling you anyway, because the failure mode it represents is the one that will hurt you in every conversion you ever do: **silent omission**. Not a crash, not an error — an absence. Loud failures are easy. This whole module is really about learning to look for quiet ones.

## BEAT 4 — The passes people forget to run

[SHOW: terminal, running the procedures and reports passes]

Which leads directly to this.

After the split, there are passes for pages, for the schema, and for queries — and it's easy to stop there, because at that point you have screens and a database and it feels finished.

Two more must run: the one that extracts **server and global procedures**, including HFSQL triggers, and the one that produces the **reports stub**.

Skip the procedures pass and you have converted the *front* of your application and left its brain behind. That layer has no screens, so nothing on your monitor looks missing.

## BEAT 5 — The file you must open before you say it worked

[SHOW ×L: `_discarded.md` open, grouped by Type with page ranges]

Last thing, and it's the habit I'd most like you to leave with.

When a page of that PDF can't be grouped into an element, it doesn't vanish quietly. It goes into `pre-convert/_discarded.md`, grouped by Type, with page ranges. The console warns you too.

Open it. Every time. Before you tell anyone the conversion worked.

Most of what's in there is exactly what you'd expect — the cover page, the table of contents, section dividers. Fine.

But if a **Type** listed in that file names a real kind of element — a window type, a report type, a procedure set — then something real didn't convert. Nobody hid it from you. It's sitting in a file called discarded, waiting to be read.

[PAUSE]

Sixty seconds of reading, once per conversion. It is the cheapest insurance in this entire course.

## SUMMARY

Five things.

The input is your **technical documentation**, not your source — an inventory, not a haystack. The mechanical work is **deterministic scripts**, not a model guessing. Classification keys on **Type, not part number**, because numbering isn't stable — and the failure mode it caused, **silent omission**, is the one to watch for everywhere. You must run the **procedures and reports passes** or you leave the backend behind. And you **open `_discarded.md`** before declaring victory.

## ACTION STEP

Before the next lesson, generate the technical documentation PDF for your own application and run the split — nothing more than that.

Then open two files: any one converted element, and `_discarded.md`. Read both.

If anything in the discarded file names a real element kind, write it down. That's your first finding, and you found it in the first ten minutes.

## BRIDGE

You've got readable Markdown out of a legacy system. Next: understanding which parts of what comes out you can trust, and which parts are a first draft wearing a convincing costume.

---
---

# Lesson 3B.4 — What Comes Out: Regenerated Screens, Schema, Queries, Reports

**Type:** Worked example · **Slot:** 13 minutes · **Narration target:** ~9.5 min

**Learning objective:** Examine each category of conversion output and judge which parts are faithful and which are drafts to be normalized later.

---

## HOOK

[SHOW ×L: title card — "Lesson 3B.4 · What Comes Out, and How Much to Trust It"]

The conversion has produced a directory of screens that look like your application, a database schema, and a set of scope documents.

The most dangerous moment in a conversion project is right now — because it looks finished, and it isn't. What you have is a **scaffold and an inventory**. Genuinely valuable, weeks of work, and not a working replacement for anything.

So this lesson is a grading exercise. For each thing that came out, I'll tell you honestly whether it's faithful, or whether it's a first draft you need to check.

## OBJECTIVE

In this lesson we're going to examine each category of conversion output, so that you know which parts you can rely on and which need your judgement before anyone builds on them.

## BEAT 1 — Where everything landed

[SHOW: the folder tree — pre-convert/ and rebuild/]

Two places.

**`pre-convert/`** — the readable Markdown, one file per element. This is your reference. It is the closest thing to truth in the whole exercise, because it's your own documentation reorganised.

**`rebuild/`** — the generated scaffold, in three parts. `pages/` holds regenerated screens as React with Tailwind and shadcn components. `db/` holds a schema in your target dialect plus an ER diagram. `scopes/` holds three documents: a queries scope, a server-and-global-procedures scope, and a reports stub.

Now the grading.

## BEAT 2 — Faithful: the inventory

The element list is **faithful**. Every window, query, procedure set and report that existed in your documentation is accounted for. Field lists are faithful. Structure is faithful.

That matters more than it sounds, and here's why.

Remember Thierry — six weeks in, asked about one pricing rule, and unable to say how many more like it existed. He had no list and no way to make one.

This is the list. It doesn't tell him what every rule *does*. It tells him exactly how many places rules can be hiding, and what each one is called. That's the difference between an unbounded problem and a finite one.

## BEAT 3 — Draft: the regenerated screens

[SHOW ×L: side by side — original WINDEV window and the regenerated page]

The pages are a **draft**, and I want to be precise about which parts.

The **structure** is broadly faithful — the fields are there, the grouping is there, the tab order is sensible.

The **layout** is a translation, not a photocopy. A WINDEV window is absolute-positioned; a React page with Tailwind is not. Things move. That's not a defect — pinning a modern responsive page to twenty-year-old pixel coordinates would be the defect.

And the **behaviour is stubs.** This is the one to be clear about. Your WLanguage code becomes a described handler — a function with the right name, in the right place, saying what it was for. It is not ported logic.

[PAUSE]

Let's look at Thierry's stock window. The regenerated page has a validate handler in exactly the right place, named for what it does, with a note describing that the original checked stock levels before confirming a movement.

What it does not have is the actual rule. Not the thresholds, not the special-price handling, not the branch-specific exception somebody added in 2019.

That's correct behaviour, not a shortfall. A tool that silently invented that logic would be far more dangerous than one that hands you a clearly-labelled gap.

## BEAT 4 — Draft: the schema, and one instruction

[SHOW: the generated schema and ER diagram]

The schema is a **draft**, in two specific ways. Column types are **inferred**, so a field your documentation described loosely may come out wider or narrower than it should be. And the names come from your legacy system, which means they follow whatever convention your team used in 2004.

Here's the instruction, and it will feel wrong: **don't fix the names now.**

There's a naming convention you'll meet later in the course, and a module dedicated to normalising a schema properly and generating migrations from it. If you hand-tidy names here, you'll do the same work twice and the two versions will disagree.

Read the ER diagram — genuinely, it's often the first time anyone has seen the shape of the whole database on one page. Note anything that looks wrong. Then leave it alone.

## BEAT 5 — The one with no screens, and the most business value

[SHOW: the server and global procedures scope]

Last, and most important.

The server and global procedures scope holds the WLanguage business-logic layer — including HFSQL trigger procedures. It is deliberately **not** scaffolded as pages, because none of it has a user interface.

Which means the single most valuable content in your legacy application arrives as a **scope document**, not as code.

[PAUSE]

Come back to Marie's question — what happens to a return on an expired special price. That rule doesn't live on the stock window. It lives in this layer, or in a trigger, where nobody looks.

So if you take one thing from this lesson: when you start scoping, the per-screen scopes are the easy half. This document is where your actual business lives, and it's the half most people skim because it has nothing to look at.

There's also a review command that compares source against generated and reports what's **missing**, **stale**, **orphaned**, or flagged for review. It changes nothing — it just tells you the truth and lets you choose. Run it whenever the source PDF changes.

## SUMMARY

Grade every category honestly.

The **inventory is faithful** — that's your finite list of hiding places. The **pages are structurally close, behaviourally stubs** — your logic is described, not ported. The **schema is inferred and legacy-named** — read it, don't fix it yet. And the **procedures scope holds the business rules**, has no UI, and is the half people skip.

You have a scaffold and an inventory. That is a great deal, and it is not an application.

## ACTION STEP

Open two files from your own conversion, side by side: one regenerated page, and the server-and-global-procedures scope.

In the page, find one handler stub and write down, in your own words, what the original actually did. You know; the document doesn't.

In the procedures scope, count the entries. That number is how many pieces of business logic you're about to be responsible for reproducing. Write it down too.

Most people find that number sobering. It's better to be sobered now than in month three.

## BRIDGE

Now do it on your own application — one screen, start to finish.

---
---

# Lesson 3B.5 — PRACTICE: Convert One Screen of Your Own App

**Type:** Practice · **Slot:** 7 minutes narration plus student work

**Learning objective:** Produce converted artifacts for a single window, page, or form from your own legacy application.

---

## HOOK

[SHOW ×L: title card — "Lesson 3B.5 · PRACTICE: Convert One Screen"]

Your turn — and the most important word in this lesson is **one**.

## OBJECTIVE

In this lesson you're going to run a conversion on your own application and examine a single screen's output properly, rather than skimming a hundred screens badly.

## BEAT 1 — What you're producing

Converted artifacts for your own application, and a proper read of **one** window's output: its `pre-convert` Markdown, its regenerated page, and its handler stubs.

The conversion runs across the whole project — that's fine, it's a batch job. What you're doing by hand is examining one screen closely.

**Pick a screen you know cold.** Not the simplest one — one you've maintained, where you know the rules that aren't written down. You need to be able to spot what's missing, and you can only do that where you already know the answer.

## BEAT 2 — The rules

**Generate the documentation fresh.** Don't use an export from last year. It has to match the application as it stands.

**Run every pass**, including procedures and reports. Front end only is not a conversion.

**Open `_discarded.md` before you decide it worked.** Every time.

**Don't fix anything yet.** Not names, not types, not layout. You're reading, not repairing.

## BEAT 3 — The first step, done

For WINDEV: open the project, generate the technical documentation for the whole project, export it to PDF, and note where it saved. It's a big file — that's expected and fine.

On VB6 or Clarion you're pointing at source or exported dictionary files instead, and everything after that is the same.

[PAUSE]

Now pause, run it on your own application, and read one screen properly. Come back when you have.

[PAUSE — "Pause here. Convert, then read one screen. Then come back."]

## BEAT 4 — What good looks like

Three signs it went well, and all three are slightly deflating.

**You found at least one behaviour that's described but not ported.** Good — that's the tool being honest, and it's exactly what you should expect.

**You opened the discarded file.** Whether or not it held anything real, the habit is the point.

**You wanted to fix the schema names and didn't.** That restraint saves you doing the job twice.

And one bonus sign: if you looked at the procedures scope and felt slightly ill at the number of entries — that's the real size of the job becoming visible. Better now.

## ACTION STEP

The practice is the action step. Just save the output and leave it untouched.

One more thing, five minutes: write down the count of entries in your procedures scope, and next to it, how many of those rules you could explain right now without looking. The gap between those two numbers is the honest scope of your conversion project.

## BRIDGE

You have converted artifacts. They aren't a plan yet — next we turn them into documents you can actually build from.

---
---

# Lesson 4B.2 — Running the Scope Pass: Resumable, Screen by Screen

**Type:** Demonstration · **Slot:** 15 minutes · **Narration target:** ~11 min

**Learning objective:** Execute the conversion scope pass across multiple screens, stopping and resuming without losing work.

---

## HOOK

[SHOW ×L: title card — "Lesson 4B.2 · The Scope Pass, Screen by Screen"]

Here is the thing nobody tells you about converting a real application: this next stage takes days. Sometimes weeks.

That's not a failure of the tooling. Forty windows means forty scope documents, each one an interview. There is no version of this that takes an afternoon, and any tool promising otherwise is generating documents nobody has thought about.

So the tool is built around that reality rather than pretending otherwise — and the single most important feature in it is the ability to stop.

## OBJECTIVE

In this lesson we're going to run the scope pass across a converted application, so that you can work through it over days without losing your place or your thinking.

## BEAT 1 — What it produces, including the three you'd forget

[SHOW ×L: the output list — per-screen scopes plus Program, Database, Backend/API]

One scope per page or window. One per report. Straightforward.

Then three you would not think to write, and would badly miss.

A **Program scope** — the project overview. What this application is, for whom, as a whole. Nobody writes this for a system that already exists, because everybody involved already knows. Then someone new arrives.

A **Database scope** — the data model as a subject in its own right, not scattered across forty screen documents.

A **Backend/API scope** — and this is the one that earns its place. It takes those legacy server procedures we talked about and proposes **endpoints**. That's the bridge from "WLanguage procedures in a monolith" to "an API a modern front end can call". It's the most genuinely architectural thing in the conversion.

## BEAT 2 — It behaves like a business analyst, not a generator

[SHOW: the scope pass running, one question at a time]

The persona is a Senior Systems and Business Analyst, and it works exactly like the scope interview does for new features: gated, section by section, one question at a time.

That's deliberate consistency. Whether you're building new or converting, the discipline is identical, and both tracks of this course converge here for that reason.

What differs is the starting material. Instead of an empty page, it starts from your converted Markdown — so it opens already knowing your fields, your queries and your procedures, and it asks about **meaning** rather than facts.

## BEAT 3 — Resumable, and how to use it properly

[SHOW ×L: the Yes / Save prompt after a completed scope]

Now the part that makes this survivable.

It asks before it starts. And after **every single scope**, it stops and offers you two things: continue, or save and stop. Progress is written to a manifest alongside your scopes, so tomorrow you pick up exactly where you left off.

Two pieces of advice about using that well.

**Stop at a scope boundary, never mid-scope.** The manifest tracks completed scopes. Abandon halfway through an interview and you'll redo that interview — and worse, you'll redo it with yesterday's thinking half-remembered.

**Two or three scopes per session. Then stop, even if you feel fine.**

[PAUSE]

I want to be blunt about why. This is interrogation, and it's tiring in a way that doesn't announce itself. What happens at scope seven is that you stop thinking and start agreeing. Every answer becomes "yes, fine, approve."

And that produces the worst possible outcome — a full set of documents that pass validation and don't describe your business. Nobody can tell by looking. You've built the illusion of a specification.

Three good scopes beat seven rubber-stamped ones, and it isn't close.

## BEAT 4 — The gap-pass: where the undocumented rules finally get written

[SHOW ×L: the analyst gap-pass output for one screen]

After each scope, it runs a gap-pass: it surfaces issues, holes, and missing behaviour, and asks you what you want to do.

This is the heart of the whole conversion, so let me be concrete.

Your documentation can tell the tool that the stock window has an expiry-date field on a special price. It cannot tell it what happens when a customer returns an item after that date has passed. That rule was never written anywhere — it's in the code, and it's in Marie's head.

The gap-pass is the moment that question gets asked, out loud, and written down.

[PAUSE]

So when it asks you something you don't know the answer to — and it will — **that is the tool working, not failing.** The correct response is not to guess. It's to go and ask Marie, and come back. That's what the save option is for.

Every one of those answers is one of Thierry's two hundred rules, moving out of somebody's head and into a document. That is the entire value of this stage.

## SUMMARY

Four things.

It produces **per-screen scopes plus Program, Database and Backend/API** — and the API scope is the real architectural step. It behaves like an **analyst**, gated and one question at a time, the same discipline as the new-build track. It is **resumable at scope boundaries** — stop between scopes, never inside one. And the **gap-pass is where undocumented rules get captured**, which means "I don't know" is a legitimate answer that sends you to ask someone.

## ACTION STEP

Run the scope pass and complete exactly **one** scope — the screen you know best.

When the gap-pass asks you something, answer properly rather than quickly. And when it offers to save, take it, even though you feel like carrying on. I want you to have used the stop before you need it.

Then open the manifest and look at it. Knowing it exists and what it tracks is what makes you willing to stop tomorrow.

## BRIDGE

One scope proves the loop. Two proves you can stop and start — which is what the real job is made of.

---
---

# Lesson 4B.5 — PRACTICE: Scope Two Screens and Validate Them

**Type:** Practice · **Slot:** 7 minutes narration plus student work

**Learning objective:** Produce validated scope documents for two screens of your own legacy application.

---

## HOOK

[SHOW ×L: title card — "Lesson 4B.5 · PRACTICE: Two Screens, Stop In Between"]

Two screens. And the exercise isn't really the screens — it's the stopping.

## OBJECTIVE

In this lesson you're going to produce two validated scope documents from your own converted application, deliberately stopping and resuming between them.

## BEAT 1 — What you're producing

Two scopes, both validated, with every finding fixed, moved, or explicitly accepted.

And a specific pairing: **the screen you understand best, and the screen you understand least.**

That second choice is deliberate, and people resist it. You'll want two easy ones. But the screen you don't understand is where the gap-pass earns its keep — it's the one where you'll be sent to ask a colleague, and it's the one whose rules are most at risk of being silently reinvented later.

## BEAT 2 — The rules

**Do them in separate sessions.** Save after the first. Come back — later today is fine, tomorrow is better. Actually stopping and restarting is the skill being practised.

**On the hard screen, "I don't know" is a valid answer.** Write down who does know, save, go and ask. That's the professional response, not a failure.

**Validate both.** Same routine as any scope: read every finding, mark it fix, move, or accept.

## BEAT 3 — Setting up the hard one

For the screen you don't understand, do one thing before you start: open its `pre-convert` Markdown and its handler stubs, and write a list of every behaviour you can't explain.

Take that list into the interview. When the gap-pass reaches one of them, you'll already know it's a real gap rather than wondering whether you've forgotten something.

[PAUSE]

Now go and do both. Come back when you have two validated scopes and at least one question you had to ask someone else.

[PAUSE — "Pause here. Two screens, two sessions. Then come back."]

## BEAT 4 — What good looks like

Four signs.

**You stopped and restarted, and nothing was lost.** Now you'll trust it on a forty-screen system.

**The hard screen took longer and produced more.** It should. That's where the undocumented knowledge was.

**You had to ask somebody something.** If you didn't, you probably picked two screens you already knew — which is comfortable and teaches you less.

**Both validated, and you can name every finding you accepted and why.** Accepting a finding is fine. Not remembering that you did is not.

## ACTION STEP

Save both scopes, then do one last thing that takes two minutes and matters more than it looks.

Count the screens in your application. Divide by two — that's your realistic per-session rate. Multiply out how many sessions this project needs.

Write that number down and tell whoever needs to know. You now have a real estimate built from measured work, rather than a hopeful one. That number is one of the most valuable things this course will give you.

## BRIDGE

Approved scopes, from an application that had none. From here, the road is the same one everybody takes — turning them into specifications a developer can build from.

---

*Generated by the lesson-scripter skill. Methodology sourced from the shipped wxConversion and wxConversionScope skill definitions, not reconstructed from memory.*
