# Spec 003: WebSocket Engine

## Overview

The WebSocket Engine is the real-time transport layer that underpins all of YappChat. Every live update — an inbound message appearing in a conversation, a PA notification bubble, an agent status changing, a directory member going online, a video room firing a participant-joined event, an org directory tree updating — is delivered through this engine.

It is a persistent, bidirectional server running on `ws://` / `wss://` that clients connect to on startup and maintain for the duration of their session. The engine is purely infrastructure: it has no business logic of its own. It receives typed **events** from YappChat server processes and routes them to the connected clients that have subscribed to the relevant **scope**.

All other specs reference this engine for their real-time delivery guarantees. Spec 003 owns the engine itself — the server, the subscription model, the authentication, the heartbeat, the reconnection with state recovery, and the event log.

The `ws` npm package (Apache 2.0) is already present in the YappChat workspace (used by Discord and Mattermost extensions). The OpenClaw gateway layer in `packages/openclaw/src/gateway/` already has WebSocket server infrastructure (`gateway/client.ts`, `gateway/server-broadcast.ts`) that this spec builds on.

**Event envelope** (canonical WSEvent shape): `{ id: string (UUID v7 — used for deduplication and replay), type: string (dot-notation e.g. 'message.inbound'), scope: string (routing key), payload: unknown, ts: number (Unix ms) }`.

**Scope / subscription model** routes each event only to clients subscribed to the matching scope: `user:{userid}` (user's own sessions — PA notifications, delivery receipts, personal presence, subagent status, MCP server status, avatar conversion, keybackup alerts), `channel:{channelid}` (anyone viewing — inbound messages, typing, delivery status), `org:{orgid}` (org members — directory + presence), `agent:{agentid}` (agent watchers — status, messages), `videoroom:{roomid}` (participants — joined/left/ended), `pairing:{pairingid}` (single-use device-pairing sessions per spec 010 FR-005 — encrypted key bundle delivery), `broadcast` (all connected clients — system maintenance, global announcements).

**Authorization rule for `pairing:{pairingid}`**: subscribe permitted ONLY when the caller is the user that initiated the pairing AND the pairing nonce in the subscribe message matches `keypairings.nonce` for that row AND the pairing has not yet expired. Spec 010 owns the pairing record; spec 003 enforces the auth check by querying `keypairings` at subscribe time. Pairings are single-use — once one ciphertext is delivered through the scope, subsequent subscribes are rejected.

**Scope Boundary** — IN SCOPE: WebSocket server (`ws://` / `wss://`); typed event envelope; scope-based subscription model; auth token validation on connect; heartbeat / ping-pong; client reconnection with `resume`-based state recovery; event log for replay (5-minute TTL); presence (online / offline / in_call); typing indicators; all event types referenced by specs 001, 002, 004, 005, 006, 007, 010; `LocalBroker` (v1 default) + `RedisBroker` (horizontal-scale path) abstraction; capacity monitoring with 70% and 90% PA-channel alerts to system admins. OUT OF SCOPE: application-level business logic (owned by each spec); message content (owned by spec 001); video media transport (owned by OpenVidu/LiveKit in spec 001); push notifications to mobile when the app is backgrounded (spec 009).

**Depends On**: None — all other scopes depend on this one. Integrates with spec 011 (auth token validation), spec 002 (`postPANotification` for capacity alerts), spec 010 (`keypairings` for pairing scope auth).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
