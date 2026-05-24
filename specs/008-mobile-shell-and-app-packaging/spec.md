# Spec 008: Mobile Shell and App Packaging

## Overview

The Mobile Shell is the native iOS and Android packaging of YappChat. Every other scope (001–007) is rendered through this shell on mobile devices. The web React UI is reused as the primary view layer; the shell adds native capabilities the browser cannot provide — secure local key storage, background lifecycle hooks, native video, deep linking, OS-level permissions, and the install target that future push notifications (spec 009) will deliver to.

**Stack decision**: **Expo (managed workflow with a custom dev client)**. The custom dev client is required because `livekit-react-native` (spec 001 video) ships native modules that the stock Expo Go binary does not include. Builds use **EAS Build**; releases use **EAS Submit**; JS-only updates use **EAS Update** (over-the-air).

The shell does NOT contain feature code. It mounts the existing React app, exposes a `MobilePlatform` capability surface to it, and delegates everything else.

**Scope Boundary** — IN SCOPE: Expo project setup; custom dev client; EAS build/submit/update pipelines; deep linking (URL scheme + universal links / Android app links); app lifecycle hook contract (`MobileLifecycle`); secure local storage for E2E keys (`SecureKeyStore`); native video module wiring (`@livekit/react-native`); OS permission flows with in-context rationale; force-upgrade gate; crash reporting + telemetry; per-device install registry (`mobiledevices`); clean linking points for future push (009) and auth (011). OUT OF SCOPE: AI logic (spec 002); WebSocket protocol (spec 003); studio (spec 004); chat panel UI (spec 005); document generation (spec 006); avatar imagery (spec 007); push notification routing and APNs / FCM payloads (spec 009); user authentication (spec 011 — `AuthGate` implementation); key backup / recovery (spec 010 — surfaced by shell when no key found); CallKit / ConnectionService integration.

**Stack pins**: Framework: Expo SDK (latest stable). React Native: version pinned by Expo SDK. Build: EAS Build. Release: EAS Submit. OTA updates: EAS Update (JS bundle only — no native code changes). Native video: `@livekit/react-native` + `@livekit/react-native-webrtc`. Secure storage: `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android). Push placeholder: `expo-notifications` — wired here, behaviour owned by spec 009. Deep linking: `expo-linking` + universal links / app links. Crash reporting: `sentry-expo`.

**Depends On**: Spec 001 (Chat Engine — video, E2E encryption keys, `userencryptionkeys.deviceid`), Spec 003 (WebSocket Engine — `resume(lastEventId)` lifecycle), Spec 005 (AI Chat — primary mobile surface), Spec 007 (Avatar — sizing), Spec 010 (key recovery flow surfaced on launch when no key found), Spec 011 (auth — `AuthGate` mount point, logout calls `SecureKeyStore.clearUser`).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
