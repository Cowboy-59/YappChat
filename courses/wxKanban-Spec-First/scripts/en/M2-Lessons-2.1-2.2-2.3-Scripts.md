# Module 2 — Lesson Scripts 2.1, 2.2, 2.3

**Course:** wxKanban Spec-First · **Module 2:** Stand Up Your wxKanban Workspace
**Covers:** the setup session — create the project, install the kit, connect the tools.
**Platform:** Windows. Single take, no macOS variant.
**Voice:** warm, technical, patient. A patient expert who dumbs down the difficult parts with exact steps and analogies.

> **Production notes.**
>
> **1. Record all three in one sitting, in order.** They run against the same machine in the same state. Lesson 2.2 opens on the folder 2.1 created; 2.3 opens on the editor 2.2 left running. Re-staging between takes costs you more than it saves.
>
> **2. Start from a genuinely clean machine.** No existing project folder, no kit installed, editor closed. If you record 2.2 on a machine that already has the kit, the install output will be wrong in a way beginners will notice and won't be able to reproduce.
>
> **3. UI labels are written functionally, not verbatim.** The narration says "create a new project", not "click the blue New Project button". Confirm the exact on-screen wording against the live app as you record and adjust in the moment — a script that names a button that has since been renamed is worse than one that describes the action.
>
> **4. Bridges never name the next lesson.** Same rule as Module 1. These recordings are shared between the Core Path and the Full course, which order them differently.
>
> **5. Word count does not estimate runtime for these three.** For a talking-head lesson, words ÷ 130 gives you the runtime. For a demonstration it doesn't, because a large part of the lesson is the viewer watching something happen — a download running, a folder unzipping, setup output scrolling, a health check completing. The narration below is deliberately shorter than the slot, leaving room for that. Budget as follows:
>
> | Lesson | Narration | On-screen action | Slot |
> |---|---|---|---|
> | 2.1 | 1,020 w · 7.8 min | ~3 min (form entry, page loads) | 11 min |
> | 2.2 | 866 w · 6.7 min | ~3 min (download, unzip, editor opens, setup runs) | 10 min |
> | 2.3 | 1,084 w · 8.3 min | ~5 min (setup output, gateway start, Cockpit load, health check) | 14 min |
>
> If a take comes in materially short, the fix is to slow the *doing* down — narrate while you wait rather than cutting to the finished state. Beginners need to see the pause; it tells them the wait is normal.

---
---

# Lesson 2.1 — Create Your Project in wxKanban

**Type:** Demonstration · **Target:** 11 minutes · **Spoken word count:** see footer · **Platform:** Windows

**Learning objective:** Create a wxKanban project and capture its stack and style profile at creation time.

---

## HOOK

[SHOW ×L: title card — "Lesson 2.1 · Create Your Project in wxKanban"]

By the end of the next ten minutes, you'll have a real project on a real board, with a real project ID, and the intent page you wrote in the last practice will have somewhere to live.

I want to be honest with you about something first, though, because it will save you a lot of second-guessing.

This is the least interesting lesson in the course. It's clicking through a form. But there's one screen in it that most people rush, and rushing it costs them for the rest of the project — so I'm going to slow right down when we get there, and I'll tell you exactly why.

## OBJECTIVE

In this lesson we're going to create your project in wxKanban and capture its stack and style, so that everything you build from here has a home and a set of technical decisions already written down.

## BEAT 1 — What we're doing, and why in this order

[SHOW ×L: browser, wxKanban dashboard, logged in]

Here's the shape of the next ten minutes.

We create the project in the web app first. Not on your machine — in the browser. And that ordering catches people out, so it's worth a sentence on why.

The project on the board is the source of truth. It's what holds your phase, your specs, your tasks, and it's what your local folder connects *to*. So the project has to exist before the folder does. You can't create it locally and push it up later; that's not how this works.

Think of it like a bank account. You open the account first, then you get the card. The card is useless on its own — it's just a way of reaching the account. Your local folder is the card.

So: project first, then the kit that talks to it.

## BEAT 2 — Creating the project

[SHOW ×L: creating a new project — name and description fields visible]

I'm creating a new project from the projects list.

Two fields matter here.

The **name** — I'm keeping this short and specific. Not "New Project", not "Test". You'll be reading this name in dropdowns and in your editor for months, and if you end up running two or three projects, a vague name is a genuine daily irritation. I'm naming mine for what it does.

The **description** — and here's where I'll pause, because there's a shortcut available.

You wrote a one-page intent in the last practice. Heading one was "what this is", in a single sentence. Paste that sentence in here.

[PAUSE]

That's not busywork. The description gets read by the AI later, when it's generating your project overview. A vague description produces a vague overview, and a vague overview quietly poisons everything downstream of it. You already did the work of writing a good sentence — use it.

And that's the project created. It has an ID now, a long string of letters and numbers. You don't need to memorise it; you'll rarely type it. But it's worth knowing it exists, because when something goes wrong later it's the first thing to check.

## BEAT 3 — The screen most people rush

[SHOW ×L: the stack and style capture screen]

Now this. This is the one.

This screen asks what you're building with — your language, your framework, your database, and the look and feel you want. And it's tempting to skim it, because at this stage you may genuinely not know, especially if you're new to this.

Here's why I'd slow down instead.

Everything the AI produces for you later gets checked against these answers. Not suggested — checked. If you say PostgreSQL here, then a spec that quietly assumes a different database is wrong, and it's wrong in a way that gets flagged rather than discovered in month three.

[PAUSE]

So the rule for this screen is: **answer what you know, and don't invent what you don't.**

If you're certain about the database, say so. If you have no view yet on the styling, leaving it broad is fine and honest. What you must not do is guess something plausible-sounding to fill the box, because a confident wrong answer here is worse than an empty one. An empty one gets asked about later. A wrong one gets built on.

And if you're converting an existing application, this is straightforward — your target stack is what you're converting *to*, not what the old system was written in.

## BEAT 4 — What you've got now

[SHOW ×L: the new project's board, phase indicator visible]

There it is.

Your project exists, it has a name and an ID, it has a stack recorded, and look at the phase indicator — you're in **Design**. Not Implementation. Design.

That's the system telling you something true: right now, there is nothing to implement, because nothing has been specified. And it won't let you skip ahead. If that feels restrictive, remember Thierry — six weeks of implementation with nothing specified is exactly the hole we're avoiding.

The board is empty, and that's correct. We fill it from your machine, which is the next thing we do.

## BEAT 5 — The one to get right, replayed

Let me replay the stack screen for a second, because it's the only decision in this lesson that's expensive to change.

If you fill it in honestly, every later check is meaningful. If you fill it in with a guess, you get one of two outcomes: either the guess is never noticed, and you build on a false statement about your own project — or it's noticed in month two, and you're changing a decision that a dozen specs now depend on.

Neither is fatal. Both are avoidable in the ninety seconds it takes to answer carefully now.

## SUMMARY

Three decisions you just watched me make.

**One**: create the project on the board before anything exists locally, because the board is the source of truth. **Two**: reuse the first sentence of your intent page as the description, because it feeds what the AI generates next. **Three**: answer the stack screen honestly, and leave blank what you genuinely don't know yet.

And you're in Design phase, with an empty board, which is exactly where you should be.

## ACTION STEP

Before you go on, create your own project, exactly as I just did. Name it properly, paste your intent sentence into the description, and take your time on the stack screen.

Then write your project's ID into your intent file, at the bottom. Thirty seconds now, and you'll never have to go hunting for it.

## BRIDGE

You've got a project in the cloud and nothing on your machine. Let's fix the second half of that.

---
---

# Lesson 2.2 — Download and Unpack the Project Kit

**Type:** Demonstration · **Target:** 10 minutes · **Platform:** Windows

**Learning objective:** Install the downloaded kit into a local folder and describe what each generated directory is responsible for.

---

## HOOK

[SHOW ×L: title card — "Lesson 2.2 · Download and Unpack the Project Kit"]

You're about to download a zip file, and when you unzip it you're going to see about a dozen folders you didn't ask for.

Most people, at this point, do one of two things. They ignore all of it and hope it works — or they open every folder trying to understand everything at once, and get overwhelmed.

Neither is necessary. There are really only four things in there you need to care about today, and I'm going to point at them directly and tell you to ignore the rest for now. You'll meet the others when you need them.

## OBJECTIVE

In this lesson we're going to download and unpack your project kit, so that you have a working local folder and know which parts of it actually matter.

## BEAT 1 — Getting the kit

[SHOW ×L: the download-kit action in the web app]

The kit is downloaded from the project you just created. That matters: it isn't a generic package you get once and reuse. It's built for *this* project, with your project's identity baked into it.

That's the first thing worth understanding, because it explains a mistake I'd rather you didn't make: if you start a second project later, you download a second kit. You don't copy the first folder and edit it. The folder knows which project it belongs to, in a couple of places, and a copied folder will cheerfully talk to the wrong project.

[PAUSE]

Downloading now. It's a zip, a few megabytes.

## BEAT 2 — Where to put it

[SHOW: File Explorer, creating the folder]

Now — where this goes matters more on Windows than you'd expect, and this is the bit I'd genuinely like you to copy exactly.

I'm putting it somewhere short and simple. Something like `C:\dev\your-project-name`.

Three specific things I'm avoiding, and each one causes real problems:

**No spaces in the path.** Some tooling handles spaces badly. It's not worth finding out which.

**Not inside OneDrive or any syncing folder.** This is the one that bites hardest. Sync tools lock files while they upload, and a build process that can't write to a file it just created produces errors that make no sense at all. You'd spend an evening on it.

**Not buried ten folders deep.** Windows has a path length limit, and deeply nested build tooling can hit it.

So: short path, no spaces, not synced. `C:\dev\` is a good habit.

Unzipping into that folder now.

## BEAT 3 — The four things that matter

[SHOW: the unpacked folder in File Explorer, then opened in VS Code]

Right. Let's open it up.

That's a lot of folders. Here are the four you actually need today.

**`CLAUDE.md`** — this is the project's primer. It's the first thing your AI assistant reads, every session. It says what the project is, what the rules are, what phase you're in. When people ask me "how does the AI know all this?", the answer is usually this file.

**`_wxAI\rules\`** — the rules themselves, one file per topic. Coding standards, database conventions, git conventions. These are auto-discovered, meaning you don't have to reference them; they're loaded whenever a command runs.

**`specs\`** — empty right now. This is where your scopes and specifications will live, one folder per numbered spec. This folder is the actual work product of this course.

**`.wxai\project.json`** — small file, easy to miss, and it's the one that holds your project ID and your current phase. When something behaves oddly later, this is where you look first.

[PAUSE]

Everything else — and there's a fair amount — is the machinery. Command definitions, the orchestrator itself, helper scripts. You don't need to read any of it today, and I'd actively rather you didn't, because there's nothing in there you need to make decisions about yet.

## BEAT 4 — Opening it, and what happens by itself

[SHOW: VS Code opening the folder, terminal output appearing]

Now I open the folder in the editor. And watch the terminal, because something happens without me asking.

The kit runs its own setup when the folder opens. It checks its connection, writes a couple of configuration files, and starts a small background service.

I'm not going to explain what each line means — that's the next lesson, and it's the most technical part of this module. For now, all I want you to notice is that it happened by itself, and that it printed something rather than nothing.

If your terminal is completely silent, that's the one thing worth knowing now. It means the setup didn't run, and the usual cause is that you opened a *parent* folder rather than the project folder itself. Open the folder that has `CLAUDE.md` sitting directly inside it.

## SUMMARY

So: the kit is per-project, not generic — download a fresh one for each project. Put it somewhere short, unsynced, and space-free. Four things matter today: `CLAUDE.md`, the rules folder, the specs folder, and `.wxai\project.json`. And opening the folder runs the setup for you.

The single most common problem at this stage isn't complicated. It's a folder inside OneDrive.

## ACTION STEP

Download your own kit and unpack it into a short, unsynced path. Open it in your editor and let the setup run.

Then open `CLAUDE.md` and read it. Just read it — top to bottom, five minutes. You don't need to change anything. I want you to have seen what the AI sees before you ask it to do anything, because from here on, when it behaves in a way that surprises you, that file is usually the explanation.

## BRIDGE

The folder is on your machine and it's talking to something. Next, we make sure it's talking to the *right* things — and we prove it.

---
---

# Lesson 2.3 — Connect the Tools: MCP, Gateway, and the Dev Cockpit

**Type:** Demonstration · **Target:** 14 minutes · **Platform:** Windows

**Learning objective:** Configure the hosted MCP connection, start the orchestrator gateway, and confirm the Dev Cockpit is attached.

> **This is the steepest lesson in the course.** It was flagged in the curriculum audit as the most likely drop-off point, and the script is built to defuse that: it names the difficulty out loud in the hook, explains each piece with an analogy before showing it, and ends by telling students exactly what to do if it didn't work rather than assuming it did.

---

## HOOK

[SHOW ×L: title card — "Lesson 2.3 · Connect the Tools"]

I'll be straight with you: this is the hardest lesson in the course, and it's the third one you hit. That's bad timing and I'm sorry about it, but there's no way around it — you can't do the interesting work until the plumbing is connected.

So here's my promise for the next fourteen minutes. I'm going to explain what each of these three things *is* before I show you connecting it, using plain language, because "MCP" and "gateway" mean nothing on their own and I'm not going to pretend otherwise.

And if it doesn't work for you first time, that's normal. It's common enough that there's a whole lesson coming up about exactly that. So if you hit a wall here, don't quit — skip ahead to the troubleshooting lesson and come back.

[PAUSE]

Let's go.

## OBJECTIVE

In this lesson we're going to connect the three pieces that let your AI assistant actually work with your project, so that you can confirm all of them are running before you write a single spec.

## BEAT 1 — What these three things are, in plain English

[SHOW ×L: simple three-box diagram — Your editor / The gateway / The hosted service]

Three pieces. Let me describe each one as a job rather than a name.

**The MCP connection** is how your AI assistant reaches your project's data — your specs, your tasks, your phase. Without it, the assistant is a very capable person with no access to your filing cabinet. With it, it can read and update the real thing.

**The gateway** is a small program that runs on your machine and carries commands from your editor to the orchestrator. It's a switchboard. It sits there quietly, and you'll almost never think about it — except when it isn't running, at which point nothing works and the errors don't obviously say why.

**The Dev Cockpit** is the editor extension that gives you buttons instead of typed commands. Strictly speaking it's optional. In practice it's the difference between seeing your project's state at a glance and going hunting for it.

Filing cabinet access, a switchboard, and a dashboard. That's all three.

## BEAT 2 — The connection, and the one mistake everyone makes

[SHOW: the setup output showing the MCP connection being written and validated]

The setup already did most of this when you opened the folder — it validated your access, wrote the connection file, and it deliberately keeps that file out of version control, because it holds a credential.

I'm showing you this rather than skipping it because sooner or later you'll set one up by hand, and there's one mistake that catches almost everybody.

The connection file holds your token. It has to hold the **actual token** — the literal string of characters. Not a reference to it. Not a variable name that points at it.

[PAUSE]

If you've worked with configuration files before, your instinct will be to write something like a `${VARIABLE}` placeholder, because in most tooling that's exactly right and it's the tidy thing to do. Here it silently doesn't work. The placeholder is never expanded, an empty credential gets sent, and the connection is refused — with an error that tells you access was denied, which sends you off checking your account rather than your syntax.

It is the single most common hand-configuration mistake there is. If you ever edit that file yourself: paste the real value in.

## BEAT 3 — The gateway, and finding out where it lives

[SHOW: terminal, gateway started, port number visible]

The gateway started by itself. You can see it here, with a process ID and a port number.

Now, a detail that will save you a genuinely frustrating afternoon at some point.

**Don't memorise that port number, and don't assume it.** It's recorded in a runtime file inside the `.wxai` folder, and that file is the authority. If you ever need to know what port your gateway is on — to check it in a browser, to see whether it's alive — read it from there rather than typing in the number you remember.

The reason is simple and it catches experienced developers hardest: if you run more than one project, they don't all use the same port. I've watched people conclude their gateway was broken when in reality they were checking a different project's port and getting nothing back. The gateway was fine. The number in their head was from another project.

So: the file knows. Your memory doesn't.

## BEAT 4 — The Cockpit

[SHOW ×L?: the Dev Cockpit panel in the editor]

The Cockpit installs as part of setup, and there it is in the sidebar.

What it gives you is a view of the thing you'd otherwise be querying — which phase you're in, which specs exist, what's outstanding. And it gives you commands as buttons, which matters more than it sounds like it should when you're learning, because you can't misspell a button.

If yours isn't showing, the usual fix is dull: reload the editor window. Extensions install while the window is already open, and they don't always appear until it reloads.

## BEAT 5 — Proving it, which is the actual point

[SHOW: terminal running the health check, all-green output]

Now the part that matters more than all of it, and it's the habit I'd most like you to take from this lesson.

**Don't assume it worked. Check.**

There's a health check command, and here's what a good result looks like: the gateway, with its port, marked healthy. The hosted service, reachable, marked healthy. All services healthy.

[PAUSE]

Look at that output for a second, because you want to know what "right" looks like now, while it *is* right. In three weeks something will break, and the fastest way to diagnose it is knowing what the healthy version looked like.

And if yours isn't green — genuinely, that's fine and you haven't done anything wrong. The next lesson exists for precisely this. Go there, work through it, come back.

## SUMMARY

Four things to take away.

**One**: three pieces — the MCP connection is filing-cabinet access, the gateway is a switchboard, the Cockpit is a dashboard. **Two**: if you ever edit the connection file by hand, paste the real token, never a placeholder. **Three**: never assume the gateway's port; read it from the runtime file. **Four**: check health rather than assuming it, and learn what green looks like while it's green.

If only one of those survives the week, make it the last one.

## ACTION STEP

Run the health check on your own project, right now, before you go any further.

Then copy the output into your notes — the whole thing, ports and all. That's your baseline. The next time something misbehaves, you'll be comparing against a real record of a working system instead of trying to remember.

If it isn't all green, don't push on and don't start changing things at random. That's what the next lesson is for.

## BRIDGE

That's the plumbing done, and it's the last of the setup. What's left is knowing what to do when it goes wrong — because at some point, on some machine, it will.

---

---
---

# Lesson 2.4 — PRACTICE: Prove Your Environment Is Healthy

**Type:** Practice · **Slot:** 8 minutes · **Platform:** Windows

**Learning objective:** Run the health check and diagnose any service that reports as unhealthy.

---

## HOOK

[SHOW ×L: title card — "Lesson 2.4 · PRACTICE: Prove It's Healthy"]

Short and important. You're going to prove your setup works, rather than assume it, and you're going to keep the proof.

## OBJECTIVE

In this lesson you're going to run the health check on your own project, record the result as a baseline, and read the rules your assistant will be working under.

## BEAT 1 — What you're producing

Two things: an all-green health check, and a written **environment record** — a few lines in a file that say what your setup looked like on the day it worked.

The record is the part people skip, and it's the part that pays. Ports, versions and endpoints are trivially available today and surprisingly hard to reconstruct in three weeks when something has changed and you can't remember what "normal" was.

## BEAT 2 — The rules

**Read the output, not just the colour.** Green is the headline. The detail — which port, which endpoint — is what you're actually recording.

**Don't skip it because setup looked fine.** Setup printing no errors and services actually running are two different claims.

**If something isn't green, don't start changing things.** Go to the troubleshooting lesson, work through it, come back. Random adjustment is how a small problem becomes two problems.

## BEAT 3 — What to write down

Four things, in a plain text file in your project:

The **date**. The **gateway port**. The **hosted service endpoint**. And your **project ID**.

That's it. Thirty seconds.

[PAUSE]

Now pause, run the health check, and write your record. Come back when it's green and saved.

[PAUSE — "Pause here. Get to green, save the record. Then come back."]

## BEAT 4 — One more thing, and it's the important one

Welcome back. Now do something that takes five minutes and shapes everything after this.

Open `CLAUDE.md` and the rules directory, and **read them**.

Not skim — read. That's the standing instruction set your assistant works under: how this project builds, what it must not do, what phase you're in. When it behaves in a way that surprises you later, the explanation is almost always in one of those files.

Then pick **two rules** you didn't know were there, and write them into your environment record.

[PAUSE]

Two reasons. It forces you to actually read rather than scroll. And when you eventually disagree with something your assistant does, you'll know whether it followed a rule you'd forgotten or ignored one — which are very different problems with very different fixes.

## ACTION STEP

The practice is the action step: green health check, saved environment record, and two rules noted from your own project's rule files.

## BRIDGE

That's the setup proven. Next: what to do on the day it isn't green — because at some point, on some machine, it won't be.

---
---

# Lesson 2.6 — When It Breaks: The Five Most Common Setup Failures

**Type:** Worked example · **Slot:** 12 minutes · **Platform:** Windows

**Learning objective:** Diagnose the five classic setup failures and record your environment details.

---

## HOOK

[SHOW ×L: title card — "Lesson 2.6 · When It Breaks"]

If your setup didn't go green, this lesson is for you, and you haven't done anything wrong.

And if it did go green — don't skip this. You'll need it on the next machine, or the day something changes underneath you. Watching someone diagnose a problem calmly is much easier than working it out for the first time while frustrated.

Five failures. Each one gets its symptom, its real cause, and its fix. Four of the five look like something they aren't, which is exactly why they cost people evenings.

## OBJECTIVE

In this lesson we're going to work through the five classic setup failures, so that you can recognise each by its symptom and fix the actual cause rather than the apparent one.

## BEAT 1 — Failure one: the credential that looks right

[SHOW ×L: config with a placeholder versus a literal value]

**Symptom:** access denied. Possibly a 401. It reads like an account or subscription problem, so you go and check your account — and your account is fine.

**Cause:** the configuration file holds a **placeholder** where the credential should be. Something in the shape of a `${VARIABLE}` reference.

If you've worked with configuration files, that placeholder is your trained instinct and it's normally correct — it's the tidy way to avoid pasting secrets around. Here it silently doesn't work. Nothing expands it, so an empty credential goes out, and an empty credential is refused exactly like a wrong one.

**Fix:** paste the literal value. This is the single most common hand-configuration mistake there is, and it wastes more time than any other because the error points you somewhere else entirely.

## BEAT 2 — Failure two: the network that's technically fine

[SHOW ×L: proxy blocking a long-lived connection]

**Symptom:** you can reach the service — a plain health check returns success — but the connection your assistant needs never establishes.

**Cause:** something between you and the internet is inspecting traffic. Corporate proxies commonly do this, and they tend to break long-lived connections while leaving ordinary short ones alone.

Which is why the symptom is so confusing: the thing you test by hand works, and the thing you need doesn't.

**Fix:** there's a local bridge for exactly this. It speaks to your editor over standard input and output — no network on that side at all — and reaches the hosted service using short request-and-response calls, which are precisely the calls already getting through your proxy.

[PAUSE]

Worth knowing this exists even if you don't need it, for one reason: the fix needs no help from your IT department. If a plain health check succeeds, the bridge will work. That turns a two-week ticket into a five-minute configuration change.

## BEAT 3 — Failure three: nothing happened at all

**Symptom:** you opened the project folder and the terminal stayed silent. No setup, no output, nothing.

**Cause:** almost always, you opened a **parent folder** rather than the project folder itself.

The setup runs when the editor opens the folder that *is* the project. Open the directory above it and there's nothing to trigger.

**Fix:** open the folder that has `CLAUDE.md` sitting directly inside it. Not one level up.

Dull, and it catches people constantly — particularly anyone who keeps several projects under one working directory and opens that directory out of habit.

## BEAT 4 — Failure four: it works, on the wrong project

[SHOW ×L: verifying project identity before running anything]

**Symptom:** everything is green, commands run, nothing errors — and the specs you're looking at aren't yours.

**Cause:** the session is pointed at a different project than you assume. That can happen through a stale default, or simply because you have more than one project and the wrong one was last active.

This is the most dangerous of the five, because **nothing is broken.** No error, no warning. Every safety mechanism in the system is working perfectly, on somebody else's data.

**Fix, and make it a habit:** verify which project you're pointed at before you dispatch anything that writes. Your project ID is in your environment record — that's part of why you wrote it down.

[PAUSE]

Same family as the migration that runs against the wrong database, and the test gate that must never point at production. The pattern is worth naming: **the expensive mistakes are usually the ones where the tool works correctly on the wrong target.** Verifying the target costs seconds.

## BEAT 5 — Failure five: the extension that went backwards

**Symptom:** the editor panel is missing, or behaving oddly, usually after you upgraded something.

**Cause:** a version conflict. An installer can replace a newer extension with an older bundled one, and the panel you'd got used to stops matching what you expect.

**Fix:** reload the editor window first — extensions installed while a window is open don't always appear until it reloads, and that alone solves it a good proportion of the time. If it persists, check the installed version against what you expect. Don't assume newer software brought a newer extension with it.

## BEAT 6 — The method underneath all five

[SHOW ×L: three pieces — credential, network, target]

Step back, because the individual fixes matter less than the method.

You have three separable things: a **credential**, a **network path**, and a **target**. Almost every setup failure is exactly one of those, and they have different symptoms once you know to look.

Access denied means **credential**. Reaches-but-won't-connect means **network**. Works-but-wrong-data means **target**. Nothing happened at all means it never started.

[PAUSE]

So don't debug "my setup is broken" — that's not a diagnosable statement. Ask which of the three it is, then check that one alone. It converts a vague bad evening into three quick questions, and it's the same discipline you'll use on every problem in this course.

## SUMMARY

Five failures. **A placeholder instead of a literal credential** — looks like an account problem. **A proxy breaking long-lived connections** — the bridge fixes it without IT. **A parent folder opened instead of the project** — nothing runs. **The wrong project selected** — nothing is broken, which is what makes it dangerous. **An extension version conflict** — reload first.

And the method: **credential, network, or target.** Identify which, check that one.

## ACTION STEP

Add to your environment record a single line naming which of the three — credential, network, or target — you'd check first for the symptom "access denied". Just to fix the mapping in your head.

Then put your environment record under version control. Create a branch, add the file, and commit it, so the record survives and is dated.

If you're new to branching, that's fine — do the simple version now, and there's a lesson later that covers what this project expects and, more importantly, what your assistant is *never* allowed to do to your history.

## BRIDGE

Environment proven, and you know what to do when it isn't. Time to start the real work.

---

*Generated by the lesson-scripter skill. Companion to `M1-Lessons-1.1-1.2-1.3-Scripts.md`.*
