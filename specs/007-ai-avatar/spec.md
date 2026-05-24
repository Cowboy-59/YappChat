# Spec 007: AI Avatar

## Overview

The AI Avatar gives the Personal Assistant (spec 002) a visual identity — an animated character that represents the assistant across YappChat. The avatar reacts to the assistant's state in real time: idle when waiting, animated ears when listening, pulsing when thinking, speaking animation when the assistant is responding.

The starter avatar library ships with **Molty** — the pixel lobster from OpenClaw (already in the YappChat workspace at `packages/openclaw/docs/assets/pixel-lobster.svg`) — plus **30 animals from the Kenney Animal Pack Redux** (CC0 public domain, SVG format). Admins pick one as the deployment-wide default; users can pick their own personal avatar from the same library.

Avatars are used in five places across YappChat: the **PA sidebar avatar** (status-bearing icon in spec 002 navigation sidebar), the **AIChatPanel header** (large featured avatar at the top of spec 005), **OrgDirectoryTree** (the PA appears in the "Assistants" group like any org member — spec 001), **Video call tiles** (if the PA is a participant in a call — spec 001 FR-007), and inline **chat message sender icons**.

The avatar is purely presentational — it reads state from the PA's real-time status (spec 003 WebSocket `pa.status` events) and animates accordingly. No AI logic lives here.

**Starter library (v1 — 12 avatars total)**: `molty` (OpenClaw, MIT, 16×16 SVG), `cat`/`dog`/`fox`/`rabbit`/`penguin`/`panda`/`parrot`/`monkey`/`elephant`/`pig` (Kenney Animal Pack Redux, CC0, SVG), `frog` (Vairus Studio, CC0, 16×16 PNG). All 12 are CC0 or MIT — no attribution required, safe for commercial use.

**Avatar state machine** — 5 named states driven by spec 003 `pa.status` events: `idle` (gentle vertical float + slow blink), `listening` (glow ring + ears pulse upward during voice input), `thinking` (slow ±5° rotation + three-dot shimmer overlay), `speaking` (subtle bounce on each token + speech arcs), `error` (droop + muted colour). Transitions are 200ms CSS cross-fade; animations are CSS keyframes only — no external animation runtime in v1.

**Allowed display sizes** — `AvatarDisplay` accepts only `24` / `32` / `64` / `128` as the `size` prop (TypeScript-enforced). Any other size is a compile error.

**Scope Boundary** — IN SCOPE: 12-starter avatar library + serving from same origin; per-user + per-company avatar selection + resolution order; avatar state machine + CSS animations + state propagation; consistent rendering across all 5 surfaces; avatar persona (name + vibe); file upload + URL import with SSRF defence; AI photo-to-avatar style conversion delegating to spec 006 image pipeline. OUT OF SCOPE: 3D avatars; full TTS lip-sync; video-based avatars; generative AI avatar creation from scratch; avatar marketplace/store; VR/AR rendering; JPEG uploads (compression artifacts at small sizes).

**Depends On**: Spec 002 (Personal Assistant — `paconfigs` reads avatar via `/api/avatar/current`, no separate `name`/`avatarurl`), Spec 003 (WebSocket Engine — `pa.status` events drive state machine; `pa.notification avatar_conversion_complete` for async conversion completion), Spec 005 (AI Chat — primary surface, 128px featured header avatar), Spec 006 (Image generation — new `POST /api/gen/image-edit` endpoint for photo-to-avatar conversion; shared `GEN_IMAGE_DAILY_LIMIT` bucket).

## Phase

**Current Phase**: design
**Priority**: medium

## Status

- **Date**: 2026-05-24
- **Phase**: design
