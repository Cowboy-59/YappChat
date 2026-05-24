# Spec 008: Mobile Shell & App Packaging

**Spec Number**: 008
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 001 (Chat Engine — video, encryption keys), Spec 003 (WebSocket Engine — lifecycle), Spec 005 (AI Chat — primary mobile surface), Spec 007 (Avatar — sizing)
**Source**: `specs/Project-Scope/008-mobile-shell-and-app-packaging.md`

---

## Overview

The Mobile Shell is the native iOS and Android packaging of YappChat. Every other scope (001–007) is rendered through this shell on mobile devices. The web React UI is reused as the primary view layer; the shell adds native capabilities the browser cannot provide — secure local key storage, background lifecycle hooks, native video, deep linking, OS-level permissions, and the install target that future push notifications (spec 009) will deliver to.

**Stack decision**: **Expo (managed workflow with a custom dev client)**. The custom dev client is required because `livekit-react-native` (spec 001 video) ships native modules that the stock Expo Go binary does not include. Builds use **EAS Build**; releases use **EAS Submit**; JS-only updates use **EAS Update** (over-the-air).

| Item | Value |
| --- | --- |
| Framework | Expo SDK (latest stable) |
| React Native | The version pinned by the Expo SDK |
| Build service | EAS Build (Expo Application Services) |
| Release service | EAS Submit (App Store + Play Store) |
| OTA updates | EAS Update (JS bundle only — no native code changes) |
| Native video | `@livekit/react-native` + `@livekit/react-native-webrtc` |
| Secure storage | `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android) |
| Push (placeholder) | `expo-notifications` — wired here, behaviour owned by spec 009 |
| Deep linking | `expo-linking` + universal links / app links |
| Crash reporting | `sentry-expo` |

The shell does NOT contain feature code. It mounts the existing React app, exposes a `MobilePlatform` capability surface to it, and delegates everything else.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat end user on iOS or Android |
| **Secondary Actors** | Mobile build operator (releases), iOS/Android OS (lifecycle, permissions), App Store / Play Store reviewers |
| **Key Value** | YappChat ships as a real native app on iPhone, iPad, and Android — with secure key storage, background detection (so push works correctly when added), native-quality video, and deep linking — without forking the codebase. The same React UI runs on web and mobile. |
| **Scope Boundary** | IN SCOPE: Expo project setup; custom dev client; EAS build/submit/update pipelines; deep linking (URL scheme + universal links); app lifecycle hook contract (`MobileLifecycle`); secure local storage for E2E keys; native video module wiring; OS permission flows; force-upgrade gate; crash reporting; per-device install registry. OUT OF SCOPE: AI logic (002); WebSocket protocol (003); studio (004); chat panel UI (005); document generation (006); avatar imagery (007); push notification routing and APNs/FCM payloads (spec 009); user authentication (separate spec). |

---

## User Scenarios & Testing

### US1 — User installs the iOS app and signs in

**Actor**: YappChat end user (iPhone)

**Scenario**:

1. User opens the App Store, searches "YappChat", taps **Get**.
2. App downloads, installs, and launches. The launch splash matches the YappChat logo and brand colour.
3. The shell mounts the React app inside a native `RootView`. The first screen is the auth flow (owned by the future auth spec).
4. After auth completes, the user is presented with native permission prompts in sequence: notifications (deferred — for spec 009), camera + microphone (only when first joining a video call), photo library (only when first uploading an attachment).
5. The user reaches the YappChat home view rendered by the React UI.

**Expected outcome**: Cold start to the first interactive screen ≤ 4 seconds on iPhone 12 or newer. No permission is requested at launch — each is requested in context when the feature is first used.

### US2 — App is backgrounded and resumed

**Actor**: YappChat end user (Android)

**Scenario**:

1. User is in the AI Chat panel mid-conversation. They press Home — the app goes to the background.
2. The shell fires a `MobileLifecycle.onBackground` event. The React app's WebSocket client (spec 003) closes the connection cleanly. Any in-flight SSE stream from the PA is aborted.
3. Two minutes later the user reopens the app. The shell fires `onForeground`. The React app reconnects the WebSocket, sends a `resume` message with the last received event id (spec 003 FR-005), and the user sees any missed PA events catch up within 3 seconds.
4. The conversation scroll position is restored to where the user left it.

**Expected outcome**: Foreground/background transitions are observable to the React layer within 100ms. Reconnection on resume completes without manual interaction.

### US3 — User taps a push notification and lands on the right surface

**Actor**: YappChat end user (iOS)

**Scenario**:

1. While the app is closed, a push arrives: "Sarah replied in #engineering" (push payload built by spec 009).
2. User taps the notification. iOS launches the app and passes a deep link: `yappchat://conversation/<conversationid>?messageid=<id>`.
3. The shell's deep-link router parses the URL and dispatches a navigation event. The React app opens the conversation view scrolled to that message id.

**Expected outcome**: From tap to the conversation view rendered, ≤ 3 seconds on a warm start, ≤ 6 seconds on a cold start. The wrong conversation is never opened — the deep-link parser is exhaustive about its routes.

### US4 — User joins a video call from the iPhone

**Actor**: YappChat end user (iPhone)

**Scenario**:

1. User taps **Join** on a video room invitation in the conversation feed (spec 001 FR-007).
2. iOS prompts for camera and microphone permission (first-time only). User grants both.
3. The shell wires the LiveKit room handle into `@livekit/react-native`. Local camera and mic tracks publish; remote participant tiles render via the same components used on web.
4. Picture-in-picture is supported when the user backgrounds the app — iOS continues showing the active speaker tile in a small floating window.

**Expected outcome**: Time from tap to joined call ≤ 5 seconds on a 4G connection. PiP transitions are smooth.

### US5 — Force-upgrade gate fires after a breaking server change

**Actor**: YappChat end user (any device)

**Scenario**:

1. The YappChat server rolls out a breaking change to the WS protocol. The server bumps `minSupportedClientVersion` to `1.4.0`.
2. A user on `1.3.2` opens the app. On startup the shell calls `GET /api/mobile/version`.
3. The response indicates the user's version is below the floor. The shell renders a full-screen blocking modal: "Update YappChat to continue", with a button that opens the App Store directly to the YappChat listing.
4. The user cannot dismiss the modal — they update, relaunch, and resume normal use.

**Expected outcome**: No old client can call any other API once the minimum version is enforced. The check happens before the React app mounts so users never see a half-broken state.

### US6 — JS-only fix ships via EAS Update with no app store review

**Actor**: Mobile build operator

**Scenario**:

1. A bug is found in the AI Chat panel rendering (spec 005). The fix touches only React code — no native modules.
2. Operator runs `eas update --branch production --message "fix: AI Chat scroll jump"`.
3. The bundle is published. Within 30 seconds it is available to all production clients.
4. Users open the app; the shell silently downloads the new bundle on launch and applies it on the next launch (or immediately if `expo-updates` is configured to reload).

**Expected outcome**: Pure-JS fixes ship without store review. Native code changes still require a full build via EAS Build and store review.

---

## Functional Requirements

### FR-001 — Expo project structure and custom dev client

The mobile shell MUST be an Expo project with a custom dev client so native modules required by the rest of the codebase (LiveKit WebRTC, `expo-secure-store`, `expo-notifications`) are available during development.

**Acceptance Criteria**:

- [ ] `apps/mobile/` workspace package created with `expo` as a dependency. The web app remains in `apps/web/` (or current location) — both consume the same `packages/ui` shared React component library
- [ ] `app.json` (or `app.config.ts`) declares: app name `YappChat`, slug `yappchat`, bundle identifier `com.wxperts.yappchat`, Android package `com.wxperts.yappchat`, supported orientations (portrait + landscape on iPad/tablets only), icon and splash assets
- [ ] `eas.json` defines three EAS Build profiles: `development` (dev client, internal distribution), `preview` (release build, internal distribution via TestFlight + Play Internal Testing), `production` (release build, store-bound)
- [ ] A custom dev client can be built with `eas build --profile development --platform ios` (and `--platform android`) and installed on a device. Running `npx expo start --dev-client` then loads the JS bundle into that client
- [ ] All native module config (LiveKit WebRTC entitlements, `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, etc.) is captured in `app.config.ts` plugins — never edited by hand in `ios/` or `android/` directories

### FR-002 — Shared UI reuse

The mobile app MUST render the same React component library as the web app. Platform branching is allowed only at the leaf component level using `Platform.OS` checks; the bulk of the spec 001–007 component code is unchanged.

**Acceptance Criteria**:

- [ ] A shared `packages/ui` (or equivalent) workspace exports the components used by both `apps/web` and `apps/mobile`
- [ ] Components that need platform-specific layout (e.g., spec 005 `AIChatPanel` is full-screen on mobile, 33vw on desktop) read from a `useResponsive()` hook that reads `Platform.OS` on mobile and `window.innerWidth` on web
- [ ] No spec 001–007 component imports `react-native-*` packages directly — platform-specific imports go through a `packages/platform` adapter so the web build does not pull in mobile-only code and vice versa
- [ ] CSS-in-JS or styling that targets DOM-only elements (e.g., `position: fixed`) is replaced with a cross-platform alternative or branched by platform. The build MUST fail if web-only CSS reaches the mobile bundle

### FR-003 — Mobile lifecycle contract

The shell MUST emit a typed lifecycle event stream that the React app subscribes to. WebSocket reconnection (spec 003), SSE abortion, and (when added) push fanout (spec 009) all read from this stream.

**Lifecycle events**:

```typescript
type MobileLifecycleEvent =
  | { type: "foreground" }    // app becomes active
  | { type: "background" }    // app moves to background but is still resident
  | { type: "inactive" }      // transient — call sheet, notification overlay
  | { type: "memory_warning" }// OS is asking the app to release memory
  | { type: "appwillterminate" } // iOS only — final notice before process kill
```

**Acceptance Criteria**:

- [ ] A singleton `MobileLifecycle` module wraps `AppState` (React Native) and emits the events above. Subscribers register with `MobileLifecycle.on(handler)`
- [ ] On every `foreground` event, the WebSocket client's `resume(lastEventId)` is automatically called by the WS provider — no per-screen wiring needed
- [ ] On every `background` event, all open SSE streams (PA chat per-session, FR-008 in spec 002) are aborted via `AbortController`. Reconnection happens on the next `foreground`
- [ ] `inactive` events do NOT trigger reconnection — they are too transient (e.g., the user pulled down notification centre)
- [ ] `memory_warning` events trigger the React app to drop cached message history beyond the visible viewport in `MessageHistoryView` (spec 001 FR-014)
- [ ] The lifecycle module exposes `MobileLifecycle.currentState()` so any code can synchronously check whether the app is foreground or background — used by the future spec 009 push fanout to decide whether to send a push or rely on the live WS

### FR-004 — Secure local storage for E2E private keys

Spec 001 FR-011 requires that E2E private keys never leave the device. On web they live in IndexedDB; on mobile they MUST live in the native secure enclave (Keychain on iOS, EncryptedSharedPreferences/Keystore on Android) via `expo-secure-store`.

**Acceptance Criteria**:

- [ ] A `SecureKeyStore` module exposes `set(userid, key, value)`, `get(userid, key)`, `delete(userid, key)`, `keys(userid)`, and `clearUser(userid)`. The `userid` argument namespaces every entry so logout of one user never touches another user's keys on the same device. On mobile it delegates to `expo-secure-store` (storage key prefixed with `<userid>:`); on web it delegates to IndexedDB (one object store per user). The interface is identical across platforms
- [ ] The X25519 private key generated on first use (spec 001 FR-011) is written via `SecureKeyStore.set(userid, "e2e-private-key", base64)`. It is never serialised to disk in plaintext outside the secure store
- [ ] On logout, the auth spec calls `SecureKeyStore.clearUser(userid)` — this removes ALL of that user's namespaced entries in one call, leaving other users on the same device untouched
- [ ] On iOS, the keychain item is configured with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` — the key is not synced to iCloud and is unavailable while the device is locked
- [ ] On Android, the secure store is backed by the hardware keystore where available (API 23+); on older devices it falls back to AES-encrypted shared preferences with a key derived from `AndroidKeyStore`
- [ ] Logging out (auth spec) clears the entire `SecureKeyStore` namespace for that user. A second user on the same device starts with a fresh key pair
- [ ] Biometric prompt is OPTIONAL in v1 — if `paconfigs` (or its equivalent in the auth spec) requests `requireBiometric: true`, reading the private key triggers Face ID / Touch ID / fingerprint via `expo-local-authentication`. Default: off
- [ ] Lost-key recovery is owned by spec 010 (Key Backup & Recovery). The shell exposes the recovery flow components on launch when no key is found in `SecureKeyStore` — `KeyRecoveryFlow` (recover from passphrase / recovery code) and `PairNewDeviceQR` (cross-device handoff from an existing trusted device)

### FR-005 — Permission flows with in-context rationale

Mobile permissions MUST be requested only at the moment the feature is first used, not at app launch. Each permission shows a rationale screen explaining why YappChat needs it before the OS sheet appears.

**Permissions used**:

| Permission | Triggered by | Rationale shown |
| --- | --- | --- |
| Notifications | First in-app prompt after auth (spec 009 will own behaviour) | "Get notified when someone messages you, your PA briefing is ready, or a meeting starts" |
| Camera | Joining a video call (spec 001 FR-007) | "Let your team see you on video calls" |
| Microphone | Joining a video call | "Let your team hear you on video calls" |
| Photo library / files | Attaching a file in AI Chat (spec 005 FR-005) | "Pick a photo or document to share" |
| Speech recognition | Voice input in AI Chat (spec 005 FR-005) | "Talk to your assistant instead of typing" — iOS only |

**Acceptance Criteria**:

- [ ] Each permission has a `PermissionRationale` screen rendered before the OS sheet. The user can choose **Allow** (proceeds to the OS sheet) or **Not now** (abandons the action and returns to the previous screen)
- [ ] If the user denies the OS sheet, subsequent attempts to use the feature show a **Settings** deep-link card: "YappChat needs camera access to start a video call. Open Settings to enable it."
- [ ] App store-required `*UsageDescription` strings on iOS and `<uses-permission>` declarations on Android are configured in `app.config.ts` plugins — never edited by hand
- [ ] The rationale screen copy is localised — English in v1, with i18n hooks in place so additional locales can be added without code changes
- [ ] Background location, contacts, calendar, and microphone-always permissions are NOT used in v1. Calendar binding (spec 002 FR-004) goes through OAuth web flow, not the device's local calendar

### FR-006 — Native video stack

Video calls (spec 001 FR-007) MUST work natively on iOS and Android using `@livekit/react-native`, with no browser WebView fallback. The same `VideoRoom` and `VideoTile` components from the web codebase render through native LiveKit modules.

**Acceptance Criteria**:

- [ ] `@livekit/react-native` and `@livekit/react-native-webrtc` are installed and configured via Expo plugins. iOS background modes for `audio` and `voip` are declared so calls survive backgrounding
- [ ] Joining a room uses the same `Room`/`LocalParticipant` API as the web — code in `packages/ui/video/*` is unchanged
- [ ] Camera, microphone, and screen share work. Screen share on iOS uses `ReplayKit` via the LiveKit broadcast extension; Android uses `MediaProjection`
- [ ] Picture-in-picture is supported on iOS 14+ and Android 8+. When the app backgrounds during a call, a PiP window shows the active speaker
- [ ] On a dropped network, the room reconnects automatically using LiveKit's built-in reconnect logic. The spec 003 WebSocket reconnect (FR-003 here) is independent — both happen in parallel
- [ ] CallKit (iOS) and ConnectionService (Android) integration is OUT OF SCOPE for v1 — calls do not show up in the OS recents list. Acknowledged as a gap

### FR-007 — Deep linking and URL routing

The shell MUST register a custom URL scheme AND universal links / Android app links so notifications, emails, and external apps can open YappChat to a specific surface.

**URL surface**:

| URL pattern | Surface |
| --- | --- |
| `yappchat://` (or `https://yappchat.app/`) | App home |
| `yappchat://conversation/:conversationid?messageid=:id` | Specific conversation, optionally scrolled to a message |
| `yappchat://session/:sessionid?messageid=:id` | Specific AI Chat session (spec 002 FR-008) |
| `yappchat://pa/notification/:notificationid` | PA channel scrolled to a notification |
| `yappchat://video/:videoroomid` | Join a video room |
| `yappchat://settings/avatar` | Avatar picker (spec 007) |
| `yappchat://settings/providers` | AI provider manager (spec 002 FR-002) |

**Acceptance Criteria**:

- [ ] The custom scheme `yappchat://` is registered in `app.config.ts` (`scheme: "yappchat"`)
- [ ] Universal links on iOS and App Links on Android are configured for `https://yappchat.app/*` (domain TBD per deployment). The associated `apple-app-site-association` and `assetlinks.json` files are served from the web origin
- [ ] A single `DeepLinkRouter` module parses incoming URLs and dispatches typed events: `{ kind: "conversation", conversationid, messageid? }`, etc. Unknown URLs route to the home surface with a non-blocking toast: "We couldn't find that page"
- [ ] Cold-start deep links are handled — if the app is launched FROM a deep link, the React app subscribes to the router before the first render and navigates immediately rather than flashing the home screen
- [ ] Per-deployment configuration (different domain for self-hosted instances) is supported — the universal link domain is a config value, not a hard-coded constant

### FR-008 — Force-upgrade gate

Before the React app mounts, the shell MUST verify the running build is at or above the server's `minSupportedClientVersion`. Older builds are blocked from making any other API call.

**Acceptance Criteria**:

- [ ] On launch (after the splash screen) the shell calls `GET /api/mobile/version` with headers `X-Client-Platform: ios|android` and `X-Client-Version: <semver>`
- [ ] Response shape: `{ minSupported: "1.4.0", latest: "1.5.2", forceUpgrade: boolean, upgradeMessage: string }`
- [ ] If `forceUpgrade: true`, the shell renders a full-screen blocking modal — title, message, and a single button that opens `https://apps.apple.com/app/idXXXXXXXX` (iOS) or `market://details?id=com.wxperts.yappchat` (Android). The user cannot dismiss
- [ ] If the user is below `latest` but above `minSupported`, a non-blocking banner appears once per session: "A new version of YappChat is available" with **Update** and **Later** actions. **Later** dismisses for 24 hours
- [ ] If `/api/mobile/version` is unreachable, the shell allows the app to launch normally — outage of this single endpoint must not lock users out

### FR-009 — EAS build, submit, and update pipelines

The mobile app MUST have automated build and release pipelines via EAS so a single command produces a store-ready binary, and JS-only patches reach users without store review.

**Acceptance Criteria**:

- [ ] `eas build --profile production --platform ios` produces an `.ipa` ready for App Store Connect
- [ ] `eas build --profile production --platform android` produces an `.aab` ready for Play Console
- [ ] `eas submit --profile production --platform ios` uploads the `.ipa` to App Store Connect for TestFlight + review
- [ ] `eas submit --profile production --platform android` uploads the `.aab` to Play Console
- [ ] `eas update --branch production --message "<msg>"` publishes a JS bundle update. Clients on `production` builds receive it on next launch
- [ ] EAS credentials (Apple distribution cert, Apple Push Notification key, Google Play service account, Sentry DSN) are stored in EAS secrets — never committed to the repo
- [ ] Each release tag in git triggers a CI job that: bumps `version` in `app.config.ts`, runs `eas build --profile production`, and creates a draft release in App Store Connect / Play Console. Final submit is gated on a manual approval

### FR-010 — Crash reporting and analytics

The shell MUST capture native crashes, JS exceptions, and basic session telemetry without exposing message content.

**Acceptance Criteria**:

- [ ] `sentry-expo` is configured with a DSN per environment (dev / preview / production). Native crashes (Objective-C / Swift / Kotlin) and JS exceptions are both captured
- [ ] Sourcemaps are uploaded to Sentry as part of every EAS build. Stack traces in production are unminified
- [ ] User identifiers attached to events are pseudonymous — `userid` only, no name or email. PII redaction is configured at the Sentry SDK level
- [ ] Message content, attachment filenames, and AI prompts are NEVER attached to events — event payloads are scanned client-side and any field matching a known content path is dropped
- [ ] Session telemetry — app launch, foreground/background transition counts, deep-link source — is sent to a YappChat-controlled endpoint (`POST /api/mobile/telemetry`). Volume is bounded: at most one batch per minute per device
- [ ] Telemetry is opt-out via a setting; default is on. The opt-out preference is stored locally so it works before auth completes

### FR-011 — Per-device install registry

The server MUST know which devices a user has installed YappChat on so future scopes (push notifications, key rotation, force-logout) have a target. Each install creates a row in `mobiledevices`.

**Acceptance Criteria**:

- [ ] On first authenticated launch, the shell calls `POST /api/mobile/devices` with `{ deviceid (UUID generated client-side and stored in SecureKeyStore), platform, model, osversion, appversion, locale, timezone }`. The server returns the row with a server-assigned `id`
- [ ] On every subsequent launch, the shell calls `PATCH /api/mobile/devices/:id` updating `lastseenat`, `appversion`, `osversion`. Throttled to once per 24 hours
- [ ] On logout, the shell calls `DELETE /api/mobile/devices/:id` — clearing the device from the registry. Spec 011 FR-007 logout invokes `SecureKeyStore.clearUser(userid)` (FR-004 here) and `DELETE /api/push/tokens` (spec 009) in the same atomic sequence so the device is fully decoupled from the signed-out user
- [ ] `GET /api/mobile/devices` returns the caller's registered devices — surfaced in a settings screen so users can review where YappChat is installed
- [ ] Admin route `GET /api/admin/mobile/devices?userid=:id` returns all devices for a user — used by support to confirm an install before troubleshooting
- [ ] `deviceid` matches the same id used by spec 001 `userencryptionkeys.deviceid` — one device, one E2E key pair, one push registration (when added)

### FR-012 — Linking points for future scopes

This spec MUST leave clean integration points for the future Push Notifications spec (009) and Auth spec (separate), without blocking either.

**Acceptance Criteria**:

- [ ] `expo-notifications` is installed and configured (Apple Push Notifications capability on iOS, FCM in `google-services.json` on Android) but the shell registers NO handlers in v1. Spec 009 wires the handlers in
- [ ] `MobileLifecycle.currentState()` (FR-003) is callable from anywhere — spec 009 will use it to decide whether a server-side WS event needs a push fanout or the user is already foreground
- [ ] The auth flow boundary is a single React component named `AuthGate`. The shell mounts it as the root. **Implementation owned by spec 011 FR-011** — `packages/ui/src/auth/AuthGate.tsx`. The stub-`userid`-from-local-config development helper is dropped now that spec 011 is drafted; dev environments use a seeded `users` row instead
- [ ] `SecureKeyStore`'s per-user namespacing (FR-004) means the future auth spec can call `clearUser(userid)` on logout and remove only that user's keys
- [ ] No code in this spec depends on Anthropic, OpenAI, or any AI provider — all AI provider config flows through spec 002 unchanged

---

## Data Requirements

| Table | Purpose |
| --- | --- |
| `mobiledevices` | One row per installed-and-authenticated app instance — used by future push (009), force-logout, device list UI |

### `mobiledevices`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user — set on first authenticated launch |
| `deviceid` | text | Client-generated UUID stored in `SecureKeyStore` — same as spec 001 `userencryptionkeys.deviceid` |
| `platform` | text | `"ios"` \| `"android"` |
| `model` | text | e.g., `"iPhone15,2"`, `"Pixel 8 Pro"` |
| `osversion` | text | e.g., `"17.4.1"`, `"14"` |
| `appversion` | text | Semver of the running app |
| `locale` | text | BCP 47 — e.g., `"en-US"` |
| `timezone` | text | IANA — e.g., `"America/Denver"` |
| `lastseenat` | timestamptz | Updated on each launch (throttled to 24h) |
| `createdat` | timestamptz | First registration |

UNIQUE constraint on `(userid, deviceid)`.

---

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/mobile/version` | Min and latest supported client versions; force-upgrade flag |
| POST | `/api/mobile/devices` | Register a device — body `{ deviceid, platform, model, osversion, appversion, locale, timezone }` |
| PATCH | `/api/mobile/devices/:id` | Heartbeat — update `lastseenat`, `appversion`, `osversion` |
| DELETE | `/api/mobile/devices/:id` | Unregister a device (logout, uninstall) |
| GET | `/api/mobile/devices` | List caller's registered devices |
| GET | `/api/admin/mobile/devices` | Admin only — list devices by `userid` |
| POST | `/api/mobile/telemetry` | Anonymous session telemetry batch (foreground/background events, deep-link sources) |

---

## Frontend Components

The shell adds a small set of components on top of the existing UI library. Everything else in spec 001–007 renders unchanged.

### Shell-level

| Component | Path | Description |
| --- | --- | --- |
| `MobileRoot` | `apps/mobile/src/MobileRoot.tsx` | Native `RootView` mount point. Subscribes to `MobileLifecycle`, mounts `DeepLinkRouter`, calls the force-upgrade gate, then renders `AuthGate` → app. |
| `AuthGate` | `apps/mobile/src/AuthGate.tsx` | Stub in v1 — replaced by the auth spec. Hands a `userid` to the rest of the app. |
| `ForceUpgradeModal` | `apps/mobile/src/ForceUpgradeModal.tsx` | Full-screen blocking modal shown when `/api/mobile/version` reports `forceUpgrade: true`. Single CTA opens the store. |
| `UpgradeBanner` | `apps/mobile/src/UpgradeBanner.tsx` | Non-blocking banner shown when below `latest` but above `minSupported`. Update / Later actions. |
| `DeepLinkRouter` | `apps/mobile/src/DeepLinkRouter.tsx` | Listens to `Linking.addEventListener('url', ...)` and on cold-start `Linking.getInitialURL()`. Parses URLs and dispatches typed navigation events. |
| `PermissionRationale` | `apps/mobile/src/PermissionRationale.tsx` | In-app screen shown before the OS permission sheet. Allow / Not now actions. |
| `SettingsRedirectCard` | `apps/mobile/src/SettingsRedirectCard.tsx` | Rendered when a permission was denied — opens the OS Settings app at YappChat's entry. |

### Capability adapters

| Module | Path | Description |
| --- | --- | --- |
| `MobileLifecycle` | `apps/mobile/src/lifecycle.ts` | Singleton wrapper around `AppState`. Emits `foreground` / `background` / `inactive` / `memory_warning` / `appwillterminate`. Used by WS provider, SSE clients, future push spec. |
| `SecureKeyStore` | `packages/platform/secure-store.ts` | Cross-platform `set/get/delete/keys` interface. Mobile: `expo-secure-store`. Web: IndexedDB with `subtle` crypto-wrapped values. |
| `useResponsive` | `packages/ui/hooks/useResponsive.ts` | Returns `{ kind: "mobile" \| "desktop", width, height }`. Drives the spec 005 panel sizing and spec 001 directory layout. |
| `Telemetry` | `apps/mobile/src/telemetry.ts` | Throttled batch sender. Drops events when offline; flushes on next foreground. |

---

## Success Criteria

1. Cold start to first interactive screen ≤ 4 seconds on iPhone 12 / Pixel 6 or newer.
2. Foreground / background transitions are observable to the React layer within 100ms via `MobileLifecycle`.
3. Reconnecting on resume completes a WS `resume` round-trip within 3 seconds on a healthy network.
4. Joining a video call from cold start ≤ 5 seconds on 4G.
5. EAS Update reaches all production clients within 60 seconds of publish.
6. EAS Build produces store-ready iOS and Android binaries from a single CI job per platform.
7. No build artifact contains hard-coded credentials, push keys, or API secrets — every secret resolved from EAS secrets at build time.
8. Crash reporting captures both native and JS exceptions with unminified stack traces in Sentry.
9. Deep links open the correct surface 100% of the time for the URL patterns listed in FR-007 — confirmed by an E2E test suite that issues each link from a controlled launcher.
10. Force-upgrade gate prevents API calls from outdated clients within 1 launch of the server bumping `minSupportedClientVersion`.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `MobileDevice` | `mobiledevices` | A single installed and authenticated app instance — platform, model, app version, last seen. Foundation for spec 009 push tokens and future force-logout flows. |
| `MobileLifecycle` | `apps/mobile/src/lifecycle.ts` | Singleton lifecycle event source — foreground/background/inactive/memory_warning/appwillterminate. Drives WS reconnection and (future) push fanout decisions. |
| `SecureKeyStore` | `packages/platform/secure-store.ts` | Cross-platform secure key storage — Keychain / EncryptedSharedPreferences on mobile, IndexedDB on web. Holds spec 001 X25519 private keys. |
| `DeepLinkRouter` | `apps/mobile/src/DeepLinkRouter.tsx` | URL parser that turns `yappchat://...` and universal links into typed navigation events. Cold-start aware. |

---

## Constraints

- The mobile app MUST use Expo's managed workflow with a custom dev client. Bare-workflow native code edits are prohibited — every native change goes through an Expo plugin so the project can be re-generated cleanly.
- The web and mobile apps share a single React component library. A component that exists in both bundles MUST behave equivalently — platform branching is allowed only at leaf nodes via `Platform.OS` or `useResponsive()`.
- E2E private keys MUST live in `expo-secure-store` on mobile. Storing them in `AsyncStorage`, `MMKV`, or any non-encrypted local store is a hard violation.
- No permission may be requested at app launch. Each is requested only when its feature is first used, after an in-app rationale screen.
- The force-upgrade gate is checked once per cold start. If `/api/mobile/version` is unreachable, the app launches normally — this endpoint must never be a single point of failure.
- Crash reports MUST NOT contain message content, AI prompts, attachment filenames, or any other PII. Field redaction is configured client-side before events are sent to Sentry.
- EAS secrets are the only acceptable source of API keys, push certs, and signing credentials. Committing any of these to the repo is a hard violation.
- iOS background modes are restricted to `audio` and `voip` (for video calls) and `remote-notification` (for spec 009). No `fetch` background mode without explicit scope expansion — Apple rejects apps that abuse it.
- Android foreground service usage is restricted to active video calls. No persistent foreground service for "always listening" features in v1.
- The mobile shell MUST NOT contain auth code, AI provider code, or chat business logic. Those live in their owning specs.

---

## Notes

### Why Expo over bare React Native or native

| Consideration | Expo (managed + dev client) | Bare React Native | Native |
| --- | --- | --- | --- |
| Code reuse with web | High — shared React UI | High | None — three codebases |
| Build pipeline | EAS — turnkey | Self-managed | Self-managed |
| OTA updates | EAS Update — first-class | Possible via CodePush (deprecated) | None |
| Native module access | Custom dev client + plugins | Direct | Direct |
| WebRTC / LiveKit support | Yes via dev client | Yes | Yes |
| Apple / Google compliance plumbing | Bundled in SDK | DIY | DIY |
| Time to first store submission | ~weeks | ~weeks–months | ~months |

The custom dev client closes the only real gap (native modules not in Expo Go). For a small team shipping web + iOS + Android together, this is the cheapest path that doesn't sacrifice native features.

### Linking with spec 003 (WebSocket)

Spec 003 FR-001 explicitly defers mobile-background handling. This spec resolves the foreground side: the WS provider subscribes to `MobileLifecycle.foreground` and reconnects automatically. The background side — push delivery — is the responsibility of spec 009, which builds on `mobiledevices` (FR-011 here) and `MobileLifecycle.currentState()` (FR-003 here).

### Linking with spec 001 (E2E keys)

Spec 001 FR-011 says private keys never leave the device. On web this is IndexedDB; on mobile this is `SecureKeyStore` (FR-004). The `deviceid` column is shared between `mobiledevices` and `userencryptionkeys` so a key rotation can target a single device cleanly when the auth spec lands.

### Risks

- **Apple App Store review**: messaging apps with E2E and video routinely face additional review. The first submission should plan for at least 2 weeks; subsequent updates typically clear within 24–48 hours. CallKit is omitted in v1 to avoid additional review surface — this is a known gap.
- **Google Play data safety form**: requires accurate disclosure of every category of data collected. Telemetry (FR-010) and `mobiledevices` (FR-011) must be reflected. A privacy review before the first submission is required.
- **Expo SDK upgrades**: a major Expo SDK bump (annual cadence) typically requires a custom dev client rebuild and may require minor changes to `app.config.ts`. Pinning the SDK version and running a pre-merge build on the upgrade branch catches breakage early.
- **`livekit-react-native` lag behind web SDK**: the React Native LiveKit SDK historically trails the JS SDK by 2–4 weeks after a release. For features released only on the web SDK, the mobile app may have to wait — acceptable given v1 video features are baseline (camera, mic, screen share, PiP).
- **iOS Picture-in-Picture for video calls**: requires `UIBackgroundModes: voip` and an active audio session. Must be tested against carrier voice calls — an incoming phone call interrupts WebRTC audio session ownership.
- **Android battery whitelisting**: aggressive power management on some OEM Android skins (Xiaomi, Samsung) can kill the app's WebSocket faster than stock Android. The push spec (009) plus user-facing guidance ("disable battery optimisation for YappChat") will mitigate, but cannot fully eliminate, this.
- **Lost-key recovery**: clearing app data on Android or deleting the app on iOS wipes the secure store — historical E2E messages become unreadable. A backup/recovery flow is acknowledged in spec 001 risks and is OUT OF SCOPE here.
- **Cold-start deep-link race**: the React app must subscribe to `DeepLinkRouter` before its first render to handle cold-start launches. A regression that mounts the home screen before the deep-link is read produces a flash of the wrong UI. An E2E test covers this on every release.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Native shell stack? | Expo (managed workflow + custom dev client). EAS Build / Submit / Update for the pipeline. |
| 2 | Bare React Native, Capacitor, or native ruled out? | Yes — Expo's custom dev client covers the native modules we need (LiveKit, secure store, notifications). Single codebase with the web app via shared `packages/ui`. |
| 3 | Where do E2E private keys live on mobile? | `expo-secure-store` (Keychain / EncryptedSharedPreferences). Never `AsyncStorage`. |
| 4 | When are permissions requested? | On first use of the feature, after an in-app rationale screen. Never at launch. |
| 5 | Push notifications in this spec? | No — only the wiring (`expo-notifications` installed, APNs/FCM capabilities declared). Behaviour and payloads are spec 009. |
| 6 | Auth in this spec? | No — `AuthGate` is a stub mount point for the future auth spec. |
| 7 | OTA updates? | Yes — EAS Update for JS-only changes. Native changes require a new build. |
| 8 | CallKit / ConnectionService integration for native call UI? | Out of scope for v1 — calls do not appear in OS recents. Acknowledged gap. |
| 9 | Tablet / iPad layout? | Supported but not optimised in v1 — landscape orientation enabled, layouts adapt via `useResponsive`. Dedicated tablet layouts deferred. |
| 10 | Background fetch? | No — relies on push (spec 009) for proactive updates. iOS background modes restricted to `audio`, `voip`, `remote-notification`. |
