# Spec 009: Push Notifications

## Overview

Push Notifications deliver YappChat events to users when they are NOT actively connected over WebSocket — when the app is closed, backgrounded, or the browser tab is not focused. Without this scope, the proactive value of YappChat (PA briefings, message mentions, calendar reminders, subagent completion) silently breaks the moment a user looks away.

This scope owns the entire fanout path: deciding *whether* to push (only when WS isn't already delivering), *what* to push (mapping a `WSEvent` to a push payload), *how* to push (APNs for iOS, FCM for Android, Web Push for browsers), and *what to do on tap* (deep-link routing into the right surface).

The scope respects YappChat's E2E commitment: for `encryptiontype: "e2e"` messages the push payload contains no plaintext content. The default delivery pattern is **silent push + fetch** — the device wakes, opens an authenticated WebSocket, decrypts the actual message client-side, then renders a local notification. A generic visible push is the fallback when the OS throttles silent pushes.

This is a server-side spec with a small client-side notification handler. The mobile shell (spec 008) already installed `expo-notifications` and declared the APNs/FCM capabilities; this spec wires the handlers and the server-side fanout worker.

**Scope Boundary** — IN SCOPE: `pushtokens` registry; APNs / FCM / Web Push provider adapters; WS-event → push-payload mapping; foreground-aware fanout worker; silent-push-plus-fetch pattern for E2E; visible-push fallback; quiet hours and per-type / per-channel mute preferences; deep-link tap target dispatch; device-token rotation and pruning; per-environment APNs key management; per-user rate limits + per-deployment global cap; delivery + tap analytics. OUT OF SCOPE: native app shell (spec 008); WebSocket transport (spec 003); E2E encryption (spec 001); the UI surfaces opened by deep links (specs 002, 005); AI agent push (spec 001 FR-010 — agent callbacks are HTTP, not push); SMS / email fallback notifications.

**Depends On**: Spec 001 (Chat Engine — message events, E2E rules), Spec 002 (PA — `panotifications`, sessions), Spec 003 (WebSocket Engine — `WSBroker` publish stream, `wssessions`), Spec 008 (Mobile Shell — `mobiledevices`, `MobileLifecycle`, `DeepLinkRouter`, `expo-notifications` capability), Spec 011 (Auth — session-required token registration, logout-driven cleanup).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
