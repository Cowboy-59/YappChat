# Module 1 — Lesson Scripts 1.1, 1.2, 1.3

**Course:** wxKanban Spec-First · **Module 1:** Why Spec-First Beats "Just Ask the AI"
**Covers:** the first 28 minutes of the course — the hook, the spine, and the quick win.
**Voice:** warm, technical, patient. A patient expert who dumbs down the difficult parts with exact steps and analogies.

> **Two production notes before you record.**
>
> **1. No brackets left.** Lesson 1.1's hook carries your own figure — "several weekends and a few dozen evenings" — supplied by you, not invented. Every other number in these scripts belongs to a fictional persona and is labelled as such.
>
> **2. Bridges never name the next lesson.** These lessons appear in both the Core Path and the Full course, in *different orders* — in the Full course 1.3 is followed by 1.4, in the Core Path it is followed by 1.5. The closing bridge of every script below points at the next *idea*, never a lesson number, so one recording serves both courses. Keep that rule for all 72 scripts.

---
---

# Lesson 1.1 — What Goes Wrong When You Let AI Write Code First

**Type:** Concept · **Target:** 10 minutes · **Spoken word count:** 1,259 · **Estimated runtime:** 9.7 min at 130 wpm

**Learning objective:** Describe the three failure modes of unspecified AI-assisted development: lost context, silent drift, and work nobody can verify.

---

## HOOK

[SHOW ×L: title card — "Lesson 1.1 · What Goes Wrong When You Let AI Write Code First"]

You know the feeling.

You've spent several weekends and a few dozen evenings building something with an AI assistant, and honestly, it's been going well. Screens are appearing. Data is saving. You've fixed things. You're starting to think this might actually work.

And then you ask for one more change. Something small. Move a button, add a field, change how a total is calculated.

And something else breaks. Something you fixed on Tuesday. And when you point that out, the assistant apologises very politely, and fixes it, and breaks a third thing.

[PAUSE]

Here's what I want you to understand before we go any further, because it changes everything about how you'll work from now on.

That is not a bad AI. That is not you being bad at prompting. That is a completely predictable failure, and it happens for three specific reasons. Once you can name all three, you'll never be confused by it again — and you'll understand exactly why everything else in this course is built the way it is.

## OBJECTIVE

In this lesson we're going to cover the three ways AI-assisted development fails when there's no written specification, so that you can recognise which one is happening to you the moment it starts.

## BEAT 1 — Failure mode one: the AI has no memory of your decisions

The first failure mode is lost context.

Here's the thing that trips almost everyone up. When you have a long conversation with an AI assistant, it *feels* like the assistant is learning your project. It isn't. It's reading back through the conversation, and a conversation is a terrible place to store decisions, because decisions get buried under everything else you said.

Think of it like this. Imagine you hired a genuinely brilliant contractor to renovate your house. World class. Fast, careful, does beautiful work. But every single morning, they arrive with no memory of the day before.

[PAUSE]

Now — you could manage that. You'd just have to tell them, every morning, everything that mattered. The sockets go at knee height. The client hates chrome. We agreed the wall stays. And if you forget to mention the wall on Thursday, the wall comes down on Thursday. Not because the contractor is careless, but because on Thursday morning, nobody told them about the wall.

That's the situation you're in. And notice where the fault actually sits: not in the contractor's skill, and not in yours. It sits in the fact that the only record of the decision was something you said out loud once.

Which leads directly to the second failure mode, because lost decisions don't just disappear — they get replaced.

## BEAT 2 — Failure mode two: silent drift

The second failure mode is silent drift.

When a decision goes missing, the AI doesn't stop and refuse to continue. It makes a new decision. A reasonable one. And that's exactly what makes this so hard to catch — every individual answer looks fine.

You only see the problem when you step back and look at the whole thing at once.

Here's the analogy I find most useful. Imagine you sent the same one-paragraph brief to six different builders, and each one built a different room of the same house, and none of them ever spoke to each other. Every room, on its own, is perfectly well built. But the light switches are at different heights. Two rooms have different door handles. One built in metric and one built in inches.

[PAUSE]

Nobody made a mistake. Everybody filled a gap in the brief with their own reasonable judgement. And the sum of all those reasonable judgements is a house that feels wrong to stand in.

That's drift. And it is quiet. It doesn't throw an error. Your app runs. Your tests, if you have any, pass. It just slowly stops being one coherent thing.

And here's what makes drift genuinely dangerous rather than just annoying, which brings us to the third one.

## BEAT 3 — Failure mode three: work nobody can verify

The third failure mode is the one that stops you selling anything, and it's this: you cannot answer the question "is it finished?"

Try it right now on something you've built. How do you *know* it's done? Not "it seems to work." How do you know? Against what?

If the answer is "I'd have to go through it and see," then you don't have a finished product. You have a thing that hasn't broken yet in front of you.

Let me make that concrete.

[SHOW ×L: split screen — left "Thierry's brief: a paragraph in a chat window", right "Thierry's brief: a two-page scope document"]

Imagine Thierry. Twenty-two years writing WINDEV, and for the last nine of them he's maintained the stock-control system for a builders' merchant — four branches, about forty users. He knows that application the way you know your own kitchen in the dark.

He decides to rebuild it as a web app, with AI help. He starts well. He describes the stock screen in a paragraph, and what comes back is genuinely good — better-looking than the original, working in an afternoon.

Six weeks in, he has something that demos beautifully. So he shows it to Marie, who runs the trade counter at the busiest branch, and has done for eleven years.

And Marie asks: "What happens when a customer returns something that was on a special price that's now expired?"

[PAUSE]

Thierry doesn't know. Not because he forgot — because that rule was never written down anywhere. It lived in the old code, in a place he'd have to go and find, and it lived in Marie's head. It was never in the brief, so the new system does something. Something reasonable. Nobody has ever checked what.

And here's the part that actually hurts: there are probably two hundred rules like that in the old system. Thierry has no list. He has no way to produce a list. So he can't tell Marie it's finished, he can't tell his boss when it will be, and he can't put it in front of a paying customer.

Six weeks of good work, and no way to prove any of it.

## BEAT 4 — What this is not

I want to be precise about one thing, because it's easy to take the wrong lesson from all this.

None of this means the AI is bad at writing code. It's very good at writing code. And none of this means the tool is going to take over the job — it isn't, and this course isn't built on that idea. What it does is answer the question you asked it. Exactly the question you asked it.

The problem in every one of those three failure modes is the same, and it isn't the answer. It's the question. Asked out loud, once, in a chat window, and then gone.

## SUMMARY

So — three failure modes.

**Lost context**: decisions live in a conversation, and conversations don't hold them. **Silent drift**: missing decisions get replaced by reasonable ones that don't match each other. **Work nobody can verify**: with no written definition of done, you can't prove anything is finished, so you can't ship it.

If you remember one sentence from this lesson, make it this one. The AI didn't fail Thierry. Thierry never wrote the brief down — and everything we do from here is about writing it down once, properly, so that it holds.

## ACTION STEP

Before the next lesson, think of the last thing you built with AI help. Anything — a script, a screen, a whole app.

Write two or three sentences naming which of the three failure modes you hit. Not all three. The one that bit you hardest, and what it cost you.

Keep it. You'll recognise it again in about twenty minutes, and I want you to have written it down before you did.

## BRIDGE

Because naming the problem is the easy half. Next, we look at what actually fixes it — and it's not a better prompt.

---
---

# Lesson 1.2 — The Spec-First Loop in One Picture

**Type:** Concept · **Target:** 11 minutes · **Spoken word count:** 1,346 · **Estimated runtime:** 10.4 min at 130 wpm

**Learning objective:** Explain how each artifact in the chain — scope, spec, task, code, test, release — constrains the one after it.

*(Contains the 60-second phase map required by the Core Path, at Beat 4.)*

---

## HOOK

[SHOW ×L: title card — "Lesson 1.2 · The Spec-First Loop in One Picture"]

Most people, when they hit the problems we just talked about, reach for a better prompt.

Longer instructions. A list of rules pasted at the top of every message. "Remember that we agreed…" Maybe a prompt they found online with a hundred lines in it.

And I understand exactly why, because it feels like the right lever to pull. But it doesn't work, and it's worth knowing why it doesn't work: a prompt is still a thing you say. It's still in the conversation. It has all three of the problems we just named, just with more words.

[PAUSE]

The fix isn't a better prompt. It's a better *document*. And more precisely, it's six documents that each hand something to the next one.

## OBJECTIVE

In this lesson we're going to cover the spec-first chain — scope, spec, task, code, test, release — so that you can explain what each link does and why removing any one of them puts the drift straight back in.

## BEAT 1 — The chain, in the order you actually use it

Here's the whole thing.

[SHOW ×L: horizontal chain diagram — Scope → Spec → Task → Code → Test → Release]

**Scope** is what we're building and, just as importantly, what we're not. **Spec** is how it behaves — the rules, the screens, the edge cases. **Tasks** are that spec chopped into pieces small enough to check off one at a time. **Code** is the build. **Test** is the proof it does what the spec said. **Release** is it going out the door with a version number on it.

Six links. And the whole idea of this course lives in one property of that chain: **each link narrows the one after it.**

Let me put that in a shape you already know.

Building a house, nobody starts by describing the kitchen to a bricklayer. There's a brief — three bedrooms, family of four, this budget. Then drawings. Then work orders for each trade. Then the build. Then the inspection. Then you get the keys.

The brief doesn't tell the electrician where the sockets go. The drawings do that. But the drawings can't contradict the brief. That's the whole trick, and it's the same trick here.

## BEAT 2 — Why constraint is the point, not the paperwork

Now, I know how this can land, especially if you've worked somewhere that had a lot of process and not much shipping. It can sound like admin. Documents for the sake of documents.

So here's the way to think about it that I've found actually sticks.

Every artifact in that chain exists to **remove decisions from the next stage**. That's its only job. And the number of decisions left open at any stage is exactly — precisely — the amount of drift you're going to get.

Let me show you the arithmetic on that, because it's more dramatic than it sounds.

Say your scope contains one line: *only signed-in users can see prices.*

One sentence. Look at what it settles. Does the price show on the public page? No. Do you need a login screen? Yes. Does the search results page show prices to a stranger? No. What does a logged-out user see instead? Something you now have to decide once, deliberately, rather than nine times by accident.

[PAUSE]

One sentence in the scope. Roughly a dozen questions that now have the same answer everywhere, forever, without anyone having to remember the conversation.

That's not paperwork. That's the mechanism.

## BEAT 3 — The rule that makes it a loop instead of a filing cabinet

Now, here's where most attempts at this fall apart, and I want to be really clear about it, because it's one rule and everything depends on it.

At some point — and it's usually week three — reality is going to disagree with your document. Somebody asks for something the spec doesn't cover. You discover the spec was wrong. It happens on every project, including mine.

There are two things you can do at that moment, and they lead to completely different places.

[SHOW ×L: two-column comparison — "Straight to the code" vs "Back to the spec first"]

Here's the same situation, handled two ways.

**Priya** gets the request: *can we add a discount field to the order screen?* It's small. She's in the code already. She adds the field, wires it up, and it works by lunchtime. Genuinely — working software, same day.

Three weeks later, someone asks whether discounts apply before or after tax. The spec doesn't say, because the spec never heard about discounts. The code says something. Priya has to go and read her own code to find out what she decided, and she finds the reports were never told about discounts at all, so the monthly totals have been quietly wrong for three weeks.

**Sam** gets the identical request. Sam opens the spec first. And writing it down takes about fifteen minutes, because writing it down forces three questions into the open: before or after tax, who's allowed to apply one, and does it show on the invoice. Sam takes those three questions to the person who asked, gets three answers, writes them in, and *then* builds it. Working software by mid-afternoon instead of lunchtime.

Three weeks later, nobody has to ask, because it's written down. And the reports got updated, because the spec change made it obvious they'd need to be.

[PAUSE]

The difference isn't that Sam is more disciplined, or slower, or more senior. The difference is four hours in week one against three weeks of wrong numbers in week four.

So the rule is: **when reality and the document disagree, you change the document first, then the code.** That's what makes this a loop rather than a folder of stale files nobody reads.

## BEAT 4 — Where the six phases fit

One more piece, quickly, so the vocabulary is in place — because wxKanban wraps that chain in six project phases, and you'll see their names constantly from here on.

[SHOW ×L: six-phase strip — Design · Implementation · QA Testing · Human Testing · Beta · Release]

**Design** is where scopes and specs get written and approved. **Implementation** is where tasks turn into code. **QA Testing** is the automated and compliance checks. **Human Testing** is real people using it and telling you what's wrong. **Beta** is a limited release to a small group. **Release** is production.

They run in that order, and here's the part that matters: wxKanban won't let you skip one. That's not there to slow you down. It's there because every one of those phases catches a specific kind of mistake, and the only way to find out which mistake you skipped is to find it later, in front of a customer.

And I'd rather you heard the honest version of that now, because you will be tempted, probably around week two.

The phase people skip is Human Testing. It's the slowest one, it needs other people, and by the time you reach it your automated tests are green and everything looks finished. So it feels like a formality.

[PAUSE]

It isn't. Automated tests check that the software does what the spec said. Human testing checks whether the spec said the right thing. Those are completely different questions, and only one of them can be answered by a machine.

Every rule Marie knows about that trade counter — that's Human Testing. There is no test you can write that finds a rule you didn't know existed. Someone who does the job has to look at it and say "that's not how we do returns."

## SUMMARY

So: six links, each one narrowing the next. Scope, spec, task, code, test, release — wrapped in six phases that stop you jumping ahead.

The single idea to hold on to is the one from Beat 2. Every document exists to take decisions away from the stage after it. Fewer open decisions, less drift. That's the entire method, and everything else in this course is just the practical detail of doing it.

## ACTION STEP

Before the next lesson, draw the chain by hand. Actual paper, actual pen — it takes two minutes and it sticks better than a screenshot.

Then, next to each of the six links, write one decision your own project has already made. Just one each. Some links will be easy and some will be blank.

The blank ones are the useful part. Those are the decisions your project hasn't made yet, and doesn't know it hasn't made.

## BRIDGE

And that's a good place to stop reading and start writing, because in the next few minutes you're going to produce the first document in that chain — and you'll be able to see the difference it makes straight away.

---
---

# Lesson 1.3 — QUICK WIN: Write the One-Page Intent That Changes Every AI Answer

**Type:** Practice · **Target:** 7 minutes · **Spoken word count:** 759 · **Estimated runtime:** 5.8 min speaking, plus a 15-minute student pause

> Runs deliberately short. This is a practice lesson: the pack's guidance caps setup instruction at three to five minutes so the student spends their time producing, not listening. The 7-minute slot is comfortably covered once the on-screen headings and the return-from-pause debrief are in place.

**Learning objective:** Produce a one-page project intent and compare the AI's response to it against its response to an unstructured request.

---

## HOOK

[SHOW ×L: title card — "Lesson 1.3 · QUICK WIN: The One-Page Intent"]

Right. Enough theory — let's get you a result.

In the next fifteen minutes you're going to write one page. And then you're going to watch that one page visibly change the quality of what your AI tool gives back. Not slightly. Obviously.

This works with any AI assistant, on any project, whether or not you ever install wxKanban. It's the smallest possible version of everything we just talked about, and it's yours from today.

## OBJECTIVE

In this lesson you're going to write a one-page project intent, so that every request you make from now on starts from a written brief instead of a paragraph you made up on the spot.

## BEAT 1 — What you're going to write

Six headings. That's the whole thing.

[SHOW ×L: the six headings on screen, held for the whole exercise]

**One — What this is.** One sentence. Not a paragraph.
**Two — Who uses it.** Name the actual roles. Not "users."
**Three — The one thing it must do.** Singular. We'll come back to that word.
**Four — What it will not do.** At least three things.
**Five — What "done" looks like.** Three statements someone else could check without asking you.
**Six — What I already know I'm stuck with.** The database you can't replace, the deadline, the platform, the budget.

One page. Handwriting is fine.

## BEAT 2 — The rules

Three constraints, and they matter more than the headings do.

**Fifteen minutes, on a timer.** This is a first draft, not a contract. You will improve it in Module 3.

**Heading three gets one sentence with no "and" in it.** If your sentence has an "and", you've got two projects. Pick the one that fails worst if you get it wrong.

**Heading four is compulsory.** Three things minimum. I know it feels strange to write down what you're not building. It is the single most valuable part of the page, and I'll tell you why after you've done it.

## BEAT 3 — The first two headings, done for you

Let me start one so you can see the level of detail. Then you're on your own.

Dana is changing careers. She used to manage a veterinary practice, and she's building a booking app for a friend who runs a mobile dog-grooming van.

**What this is:** *A booking app that lets dog owners book a grooming slot at their own address, and lets the groomer see her day as a route.*

**Who uses it:** *The dog owner, booking on a phone, usually in the evening. The groomer, one person, checking her round in the van each morning. Nobody else.*

Notice what Dana did there. Not "customers and staff." A dog owner on a phone in the evening, and one groomer in a van in the morning. That's specific enough that an AI can make sensible layout decisions on its own — and specific enough that when it makes a bad one, you'll spot it.

[PAUSE]

That's your level. Two sentences, both concrete.

Now pause the video, set a timer for fifteen minutes, and write all six headings for your own project. Come back when you've got a page.

[PAUSE — "Pause here. Fifteen minutes. Then come back."]

## BEAT 4 — Now use it, and see the difference

Welcome back.

Now here's the part that makes this a win rather than an exercise.

Open your AI assistant. Paste your whole page in. Then, underneath it, ask for the first real thing you need — a screen, a data model, a plan, whatever's actually next for you.

Read what comes back. Then think about what you'd have got if you'd just asked the question cold.

[PAUSE]

Two signs you did this well, and they're both slightly uncomfortable.

**One:** heading four was the hardest to write. Good. Every line in it is an argument you're not going to have in week six.

**Two:** you changed your mind about heading three while writing heading five. That's not a mistake — that's the page working. "What done looks like" is where vague ambitions go to get specific, and it very often reveals that the one thing you said it must do isn't the one thing at all.

If both of those happened, you've just done, in fifteen minutes, the thing Thierry never did in six weeks.

## ACTION STEP

The practice is the action step, so just one more instruction: save it.

Make a folder for this project if you don't have one, and save the page in it as `intent.md`. Plain text, nothing fancy.

Don't put it in a chat window. Put it in a file. That distinction is the whole course in miniature — and you'll open that exact file again when you write your first real scope.

## BRIDGE

Keep that page close. From here on, everything we build points back at it — and the next thing is deciding which road you're taking to get there.

---

---
---

# Lesson 1.5 — Choose Your Track: Build New or Convert a Legacy App

**Type:** Synthesis · **Slot:** 9 minutes

**Learning objective:** Evaluate your own starting point and record a decision on which track to follow for the rest of the course.

---

## HOOK

[SHOW ×L: title card — "Lesson 1.5 · Choose Your Track"]

One decision, and then we get to work.

From the next module onwards this course forks. One road builds something new. The other converts an application that already exists — WINDEV, WEBDEV, Visual Basic, Clarion.

They rejoin later, and everything after the fork is identical. But the next stretch is genuinely different depending on which you are, so it's worth two minutes to pick correctly rather than defaulting.

## OBJECTIVE

In this lesson you're going to decide which track you're on and write that decision down, so that the next module starts from a choice rather than an assumption.

## BEAT 1 — The question that actually decides it

Most people assume the question is "do I have a legacy application?"

It isn't. The question is: **is the legacy application the source of the requirements?**

[PAUSE]

That's a different question, and it separates two people who look identical from the outside.

If your job is *"make this existing system work in a browser, doing what it does today"* — then the old application is your specification. Everything it does is a requirement, including the parts nobody remembers. That's **Track B**.

If your job is *"build something better, and the old system is one input among several"* — then the old application is a reference, not an authority. You're deciding what should exist, not recovering what does. That's **Track A**.

## BEAT 2 — Three situations that trip people up

Let me do the awkward cases directly, because these are the ones where people pick wrong.

**"I have a WINDEV app but I want to redesign it properly."** Track A. You're building new, using the old system as one input. Take Track A, and use the conversion tooling later as a research exercise if you want an inventory of what exists.

**"I'm building something new, but it has to import twenty years of data."** Track A — with one addition. The data migration is its own scope, and it deserves proper treatment rather than being smuggled into another feature.

**"I need an exact replacement, and it must behave identically."** Track B, without hesitation. Do not attempt this by writing fresh specs from memory. The rules you don't remember are the ones that will bite, and Track B exists precisely to drag them into the open.

And if you're a career changer with no legacy system at all: Track A. That's the straightforward case, and there's nothing you're missing.

## BEAT 3 — What each track actually costs

Fair warning on both, briefly.

**Track A** is more open-ended. Nobody hands you the requirements; you have to decide what should exist, and that's harder than it sounds when the page is blank.

**Track B** is more work up front, and there's a specific emotional shape to it: you will discover that your application does things nobody documented, and there will be more of them than you expect. That's not a failure of your team. It's what every mature system looks like when you finally count.

[PAUSE]

Neither is the easy road. They're different roads.

## SUMMARY

The deciding question is **whether the legacy system is the source of requirements** — not whether one exists. If it *is* the specification, take the conversion track. If it's a reference, build new. Data migration is its own scope. And an exact replacement is never something to write from memory.

## ACTION STEP

Write your decision at the bottom of your intent page, in one sentence, with the reason.

Something like: *"Track B — the existing stock system is the specification, and we need behavioural parity for the four branches."* Or: *"Track A — new booking product; the old spreadsheet is a reference only."*

The reason matters more than the choice. In three weeks, when it's hard, you'll want to know what you were thinking.

## BRIDGE

Decision made. Now let's get the workspace standing up, because both roads run through the same one.

---

*Generated by the lesson-scripter skill. Companion to `wxKanban-Spec-First-Curriculum-Blueprint.md` and `wxKanban-Spec-First-Core-Path.md`.*
