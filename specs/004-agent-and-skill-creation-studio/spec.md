# Spec 004: Agent and Skill Creation Studio

## Overview

The Agent & Skill Creation Studio is the workbench where developers and power users build, test, manage, and version the **skills** and **agent templates** that extend YappChat's Personal Assistant (spec 002).

**Skills** are single-function tools — an HTTP endpoint, a name, a description, and a JSON input schema. The PA calls them when a user's request maps to their capability. Spec 004 owns the `skills` table: creating, editing, versioning, testing, and generating starter handler code.

**Agent templates** are reusable subagent configurations: a name, avatar, system prompt, assigned skill set, and AI provider. When the PA needs to spawn a subagent for complex multi-step work, it picks the right template from the library. Spec 004 is where those templates are designed and tested.

This scope is the back-end studio — the forms, editors, test consoles, and version history that let teams extend YappChat without touching core engine code. The PA's conversational skill-creation (spec 002 FR-006) is a lightweight front door to this studio; spec 004 is the full workshop.

**Ownership boundary**: The `skills` table is owned EXCLUSIVELY by this spec — no other spec writes to it directly. Spec 002 FR-006's conversational skill creation calls `POST /api/pa/skills/register` which calls `POST /api/studio/skills`. Skill execution at runtime is owned by spec 002 FR-014 (this studio defines, tests, versions, exports — but the actual HTTP call to `handlerurl` with `X-Skill-Token` lives in spec 002). Subagent execution at runtime is owned by spec 002 FR-015 (this studio defines templates; spec 002 spawns and supervises instances). `skillinvocations` and `subagentexecutions` are READ-ONLY from this spec — spec 002 owns both tables.

**Spec 005 integration (FR-008)**: when a user expresses creation intent in the AI Chat panel, the panel expands to full screen and mounts the spec 004 Studio with the user's description pre-loaded into the Studio Assistant (Archie). The Studio MUST accept an optional `initialDescription` prop so the AI Chat can pass the user's message directly to Archie without requiring re-entry.

**Scope Boundary** — IN SCOPE: skill CRUD; skill JSON schema editor (Draft 7); skill handler test console; handler code generation (TypeScript, Python, JavaScript); skill version history and rollback; agent template CRUD; agent template test console with sandbox; skill and agent metrics (read-only from spec 002 tables); skill import/export bundles; Studio Assistant persona (Archie) with similarity detection + guided creation; community skill publish (delegates to spec 002). OUT OF SCOPE: PA conversation UI (spec 005); community skill marketplace browsing (spec 002); actual skill handler runtime (deployed externally, owned by spec 002); agent execution engine (spec 002); MCP server management (spec 002).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
