# Spec 005: AI Chat

## Overview

The AI Chat is a **slide-in panel** that opens whenever a user clicks the PA avatar or a PA notification bubble. It is not a dedicated page — it overlays the existing YappChat view.

**Desktop**: the panel occupies the right **1/3 of the screen** (approximately 33% viewport width). The rest of the application remains visible and interactive behind it. The panel slides in from the right edge.

**Mobile**: the panel expands to **full screen**, covering the full viewport.

This scope is **entirely UI**. The intelligence, session storage, skill invocation, and subagent management all live in spec 002. Spec 005 owns the visual surface: how messages look, how responses stream in, how sessions are managed, how skill results are rendered, and how the user composes and sends messages.

**Entry points** — the only two ways to open the AI Chat panel. Both are dispatched as the `OpenAIChatPanel` action contract owned by spec 002 FR-001: **PA notification bubble click** fires `OpenAIChatPanel({ source: 'bubble', notificationId })` (panel opens scrolled to and highlighting the linked message); **PA avatar click** fires `OpenAIChatPanel({ source: 'avatar' })` (panel opens at the most recent conversation position). Spec 002 emits the action; spec 005 subscribes to it and owns the open animation, the panel surface, and the scroll-restoration behaviour. There is NO direct coupling between spec 002 components and spec 005 components beyond this typed action.

Clicking outside the panel (desktop) or pressing Back (mobile) closes it without losing state — the session resumes exactly where it was left when reopened.

**Scope Boundary** — IN SCOPE: right-1/3 slide-in panel (desktop); full-screen overlay (mobile); open/close animation triggered by PA avatar or notification bubble click; session list within the panel; multi-session management (create, rename, delete, search); streaming SSE message rendering; markdown and code block rendering; structured skill result cards; tool-call indicator animations; voice input (browser Speech API); file attachment upload; keyboard shortcuts + command palette; suggested follow-up chips; session export; studio handoff for skill/agent creation intents. OUT OF SCOPE: dedicated `/chat` route or full-screen desktop mode; PA backend session logic (spec 002); skill invocation engine (spec 002); subagent management (spec 002); PA notification bubbles (spec 002); AI Avatar rendering (spec 007); PA proactive monitoring (spec 002); external channel messages (`UnifiedMessageFeed` in spec 001).

**Library choices**: `react-markdown` + `remark-gfm` plugin for GitHub-Flavored Markdown (tables, strikethrough); `highlight.js` via `rehype-highlight` plugin for code highlighting (lighter than Prism for our use case); `@tanstack/react-virtual` (or `react-virtual`) for virtualised message thread; browser native `SpeechRecognition` API for voice input (Chrome/Edge only — Firefox not supported as of 2026).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
