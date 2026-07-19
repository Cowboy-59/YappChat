# SCOPE-091: Project Systems — AI Remote Management of Bound Projects

**Scope Number**: 091
**Status**: `draft` (stub — not yet fully scoped; captured so the vision has a home)
**Created**: 2026-07-18
**Last Reviewed**: 2026-07-18
**Depends On**: SPEC-090 (Chat Groupings Foundation — the `projects`-type grouping + `groupingid` binding this is built on), SPEC-001 (Common Chat Engine — messages carrying commands/results), SPEC-003 (WebSocket engine — realtime relay between room and agent), SPEC-011 (auth), SPEC-017 (chat translation engine — reused for the auto-translated status feed), SPEC-088/089 (ephemeral tokenized agent + desktop shell — the connectivity/agent-runtime precedents)
**Source**: `specs/Project-Scope/091-project-systems-ai-remote-management.md`

> **Status note:** This is a **deferred, large** scope captured as a stub. It must go through its own full brainstorming/scoping pass before implementation. SPEC-090 ships first and independently. Nothing here is committed design yet — the sections below record the agreed *intent* and the questions that must be answered.

## Overview (intent)

A grouping of **`type = 'projects'`** (from SPEC-090) turns each room filed under it into a **two-way control channel between the chat room and an AI agent that remotely manages a real codebase project**. Example: a user creates a "PROJECTS" grouping and adds the **"yappchat"** room; that binds *this* development project to the room, so the project can be driven from the conversation.

Confirmed behavior is **bidirectional (both directions), with an interactive agent**:
- **A — Chat drives the agent**: a person types a natural-language request in the room; a **Claude Code–style agent** runs it against the bound repo and posts results/diffs back into the room.
- **B — Project reports into the room**: the project pushes status / notifications / build results into the room as messages.
- **Interactive loop**: the agent **may pause mid-task, ask a clarifying question in the room, and wait for a human answer before continuing.**
- **Auto-translation**: messages in a `projects` room (at least the status/report flow, B) are **auto-translated into the app's other 5 languages** using the existing translation engine (SPEC-017), so the feed is readable by all members regardless of language.

## Core intent (to be refined)

| Element | Value |
| --- | --- |
| **Primary Actor** | A user in a `projects`-type room issuing natural-language dev requests and answering the agent's questions. |
| **Secondary Actors** | The bound AI coding agent (Claude Code–style) operating on the repo; the bound codebase/project itself (source of status reports); the realtime engine (spec 003) relaying room↔agent; the translation engine (spec 017); SPEC-090 groupings providing the binding surface. |
| **Key Value** | Manage and drive a real software project from inside a YappChat conversation — issue work, answer the agent's questions, and watch status stream back, translated for every member — without leaving the chat. |

## Business Problem (intent)

SPEC-090 delivers the `projects`-type grouping as an inert container. The value the user actually wants is remote management: binding a room to a codebase so the team can operate the project conversationally and receive its status in-channel, in their own language. This is a large subsystem — agent connectivity and runtime, authorization to act on a specific repo, command relay, an interactive question/answer loop, result/diff streaming, a status-event feed, translation fan-out, and a substantial safety/permissions surface — which is why it is deliberately separated from the foundation.

## Scope Boundary (draft — to be finalized in full scoping)

**Likely IN:** binding a `projects` grouping/room to a specific project/repo; relaying room messages → agent and agent output → room over spec 003; the interactive ask-a-question-and-wait loop; a project→room status/report feed; auto-translation of the feed via spec 017; per-binding authorization (who may drive the agent).

**Likely OUT / later:** non-`projects` groupings (they stay inert — SPEC-090); multi-repo per room; autonomous/unattended agent action without a present human; anything already owned by SPEC-090 (the grouping CRUD/placement itself).

## Key open questions (must resolve before implementation)

- **Agent runtime**: Is the agent literally **Claude Code driving a working copy of the repo** on a machine/server (the 088/089 ephemeral-agent / desktop-shell lineage), or a lighter in-app agent with a fixed set of project actions? This decides the whole size and security model.
- **Where the repo lives & who acts on it**: which machine holds the working copy, how the agent authenticates to it, and how write actions (commits/branches/PRs) are authorized and audited.
- **Command/permission model**: which room members may issue commands vs. only view; approval gates for destructive actions; how the "answer to continue" loop is presented and secured.
- **Binding**: how a room is bound to a concrete project (declare a repo/path? select from a registry?) and how binding maps to `chatgroupings.type = 'projects'` + `conversationmembers.groupingid`.
- **Translation scope**: is auto-translation applied to the status/report feed only (B), or also to human↔agent command turns (A)? Confirmed at least the reports; A-turns TBD.
- **Type immutability**: once a project is bound, is changing the grouping's `type` back to `general` blocked (deferred from SPEC-090)?

## Notes

- This stub exists so the remote-management vision is not lost and SPEC-090 has a documented downstream consumer. **Do not implement from this stub** — run a dedicated scoping pass first.
- Precedents to draw on: SPEC-088 (ephemeral single-use tokenized agent, fail-closed session model, consent + audit) and SPEC-089 (minimal desktop shell / in-process agent runtime) are the closest existing patterns for connecting an out-of-browser agent to YappChat.
