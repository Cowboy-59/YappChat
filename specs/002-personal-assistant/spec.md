# Spec 002: Personal Assistant

## Overview

The Personal Assistant (PA) is a **proactive AI avatar** embedded in YappChat. It is not a chatbot you pull up when you need something — it watches over the chat engine continuously and surfaces what matters: pending messages, upcoming calendar events, project items due, and actions taken by YappChat on your behalf.

When you want to interact with it, you can: ask it to build a presentation, create a new skill, show your week ahead, summarize your unread messages, or draft a reply. All of this happens through natural conversation in the PA's dedicated YappChat channel or in named multi-turn sessions rendered by spec 005's AI Chat panel.

The PA is **AI-provider-agnostic**. Any AI that can be registered — Claude, GPT-4, Gemini, a local Ollama model, a self-hosted LLM, or a custom model behind an OpenAI-compatible endpoint — can power the PA. The user configures which AI backs their PA; the PA layer handles routing, context management, and tool invocation the same way regardless of provider.

The PA appears in the YappChat org directory as an avatar with its own channel (registered via spec 001 FR-010). It has a name, an avatar image, and a live status showing what it is currently doing.

**Ownership boundaries**: The PA does NOT store its own display name or avatar URL — both are resolved at runtime from spec 007 `GET /api/avatar/current`. `paconfigs` carries only behavioural config (provider, briefing time, monitoring interval, notification prefs). The full-screen / slide-in chat surface is owned by spec 005 (`AIChatPanel`). Spec 002 owns the trigger contract (`OpenAIChatPanel` action) but does NOT define the panel UI. Skills and agent templates are designed and tested in spec 004; spec 002 owns the runtime that actually invokes skill handlers (FR-014) and spawns subagents (FR-015).

**Scope Boundary** — IN SCOPE: PA avatar registration + dedicated channel; AI provider registry (provider-agnostic); proactive monitoring of messages / calendar / project items; calendar + email OAuth bindings; skill discovery + interactive skill creation + community publishing + update notifications; presentation / content generation via spec 006 with conversational UX; day/week/month schedule view; pending message dashboard; named multi-turn `assistantsessions` (backs spec 005 AI Chat surface); skill invocation runtime + subagent execution runtime; step-by-step setup guidance for every external integration; internal `postPANotification` SDK used by other server-side scopes; OAuth callback handler shared across bindings; MCP server registration + tool aggregation. OUT OF SCOPE: AI Avatar rendering / animation (spec 007); skill execution definition / test console / version history (spec 004); the AI Chat full-screen surface itself (spec 005); billing.

**Depends On**: Spec 001 (chat engine — PA registers as an agent via FR-010, all PA messages flow through internal `yappchat-agent` channel, pending message counts read from `messages` + `conversations`), Spec 004 (`skills` and `agenttemplates` tables — PA writes definitions through spec 004's API and reads them at invocation time), Spec 006 (Document Generation — content creation calls spec 006's API), Spec 003 (`WSBroker.publish` for `pa.notification` and `subagent.status` events), Spec 007 (`avatarconfigs` is the source of truth for name + avatar), Spec 011 (auth: `requireAuth`, `issystemadmin` flag for system-default provider).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
