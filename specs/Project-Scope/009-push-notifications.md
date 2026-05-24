# Spec 009: Push Notifications

**Spec Number**: 009
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 001 (Chat Engine — message events, E2E rules), Spec 002 (PA — `panotifications`, sessions), Spec 003 (WebSocket Engine — event publish bus), Spec 008 (Mobile Shell — `mobiledevices`, `MobileLifecycle`, `DeepLinkRouter`)
**Source**: `specs/Project-Scope/009-push-notifications.md`

---

## Overview

Push Notifications deliver YappChat events to users when they are NOT actively connected over WebSocket — when the app is closed, backgrounded, or the browser tab is not focused. Without this scope, the proactive value of YappChat (PA briefings, message mentions, calendar reminders, subagent completion) silently breaks the moment a user looks away.

This scope owns the entire fanout path: deciding *whether* to push (only when WS isn't already delivering), *what* to push (mapping a `WSEvent` to a push payload), *how* to push (APNs for iOS, FCM for Android, Web Push for browsers), and *what to do on tap* (deep-link routing into the right surface).

The scope respects YappChat's E2E commitment: for `encryptiontype: "e2e"` messages the push payload contains no plaintext content. The default delivery pattern is **silent push + fetch** — the device wakes, opens an authenticated WebSocket, decrypts the actual message client-side, then renders a local notification. A generic visible push is the fallback when the OS throttles silent pushes.

This is a server-side spec with a small client-side notification handler. The mobile shell (spec 008) already installed `expo-notifications` and declared the APNs/FCM capabilities; this spec wires the handlers and the server-side fanout worker.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat user (off-app) |
| **Secondary Actors** | YappChat server (WS publish bus, fanout worker), Apple APNs, Google FCM, Browser Web Push services (Mozilla autopush, Apple WebPush, FCM) |
| **Key Value** | Users hear about what matters even when YappChat isn't open. The PA's proactive promise — "always-on assistant that surfaces what needs attention" — is finally honoured for backgrounded and closed clients. Battery cost is bounded; privacy is preserved. |
| **Scope Boundary** | IN SCOPE: `pushtokens` registry; APNs / FCM / Web Push provider adapters; WS-event → push-payload mapping; foreground-aware fanout worker; silent-push-plus-fetch pattern for E2E; visible-push fallback; quiet hours and per-type mute preferences; deep-link tap target dispatch; device-token rotation and pruning; per-environment push key management. OUT OF SCOPE: native app shell (spec 008); WebSocket transport itself (spec 003); message content / E2E encryption (spec 001); the actual UI surfaces opened by deep links (002, 005); AI agent push (spec 001 FR-010 — agent callbacks are HTTP, not push); SMS / email fallback notifications. |

---

## User Scenarios & Testing

### US1 — User receives a PA morning briefing while the app is closed

**Actor**: YappChat end user (iPhone, app closed)

**Scenario**:

1. At 8:00 am the PA fires its morning briefing (spec 002 US1). It writes a `panotifications` row and publishes a `pa.notification` WSEvent scoped to `user:{userid}`.
2. The push fanout worker picks up the event and queries the user's connection state. The user has no foreground WS session — they are eligible for push.
3. The worker queries `pushtokens` for the user. They have one iOS token. The payload built is generic-visible: `{ alert: { title: "Andy", body: "Your morning briefing is ready" }, "content-available": 1, sound: "default" }` plus a deep link `yappchat://pa/notification/<notificationid>`.
4. The worker calls APNs. Delivery succeeds.
5. The user sees the notification on their lock screen. They tap it. iOS launches the app with the deep link. Spec 008's `DeepLinkRouter` opens spec 005's `AIChatPanel` scrolled to that notification.

**Expected outcome**: From the PA writing the notification to the lock-screen banner appearing, ≤ 5 seconds. Tap-to-target rendered ≤ 6 seconds on a cold start.

### US2 — Mention arrives in Slack, user is mid-conversation in YappChat

**Actor**: YappChat end user (iPhone, app foregrounded in a different conversation)

**Scenario**:

1. An external Slack user mentions @andy in #engineering. The Slack adapter (spec 001) acks the inbound message and the WS engine publishes `message.inbound` scoped to `channel:{channelid}` with `mentions: ["andy"]`.
2. The push fanout worker checks: the user is foregrounded with a live WS session subscribed to that channel. The event will arrive over WS naturally — no push is needed.
3. The user sees the message appear in their feed via the WS-driven update, with a mention highlight.

**Expected outcome**: No push is sent. The user gets the in-app indicator only. Battery and notification noise are preserved.

### US3 — E2E message arrives, silent push wakes the app, content stays private

**Actor**: YappChat end user (Android, app backgrounded)

**Scenario**:

1. Another YappChat user sends an E2E direct message to the user. Spec 001 stores ciphertext only — `messages.content` is NULL. WS publishes `message.inbound` with `encryptiontype: "e2e"` and `encryptedpayload` (no plaintext).
2. The push fanout worker detects the user is backgrounded and the message is E2E. It builds a *silent* FCM payload: `{ "data": { "type": "wake-and-fetch", "scope": "channel:abc", "messageid": "..." } }` — no `notification` block.
3. FCM delivers to the device. The app's data-only handler runs in the background, opens the WS, fetches the encrypted blob, decrypts client-side, and calls `Notifications.scheduleNotificationAsync` to render a local visible notification with the decrypted preview: "Sarah: see you at 3?"
4. The user sees the local notification. The push provider never saw the plaintext.

**Expected outcome**: Silent push → local notification path completes within 4 seconds. Push provider logs contain no plaintext message body.

### US4 — User taps a calendar reminder push

**Actor**: YappChat end user (iPhone)

**Scenario**:

1. PA fires a calendar reminder 15 minutes before a meeting (spec 002 FR-003). Notification deep link: `yappchat://video/<videoroomid>` if the meeting has a YappChat video room, else `yappchat://pa/notification/<notificationid>`.
2. The user taps the push. iOS opens YappChat. Spec 008's `DeepLinkRouter` parses the URL, dispatches to spec 005 / spec 001 as appropriate, and the user lands on the right screen.

**Expected outcome**: Single tap takes the user from lock screen to the video-room join page or the PA notification, with no extra navigation.

### US5 — User sets quiet hours and stops getting pushes overnight

**Actor**: YappChat end user

**Scenario**:

1. User opens push settings, enables quiet hours from 10pm to 7am (in their device-reported timezone, which the server has from spec 008 `mobiledevices.timezone`).
2. The setting is written to `notificationpreferences` for that user.
3. At 11pm, a non-urgent inbound message arrives. The fanout worker checks quiet hours: user is in quiet window. The push is suppressed; the WS event still flows when they open the app.
4. At 2am, a calendar reminder for a 2:15am meeting fires. The worker checks: this notification type is configured to bypass quiet hours (`bypassQuietHours: true` per type). Push is delivered.
5. At 7:01am, all suppressed pushes that were marked `replayOnExit` are NOT redelivered (avoids morning notification flood). The events are still readable in-app.

**Expected outcome**: Quiet hours suppress noisy pushes but never block urgent ones. No flood when quiet hours end.

### US6 — User logs out, push tokens are cleaned up

**Actor**: YappChat end user

**Scenario**:

1. User signs out on their iPhone. Auth spec calls `DELETE /api/push/tokens?deviceid=<id>`.
2. All `pushtokens` rows for that user-device pair are deleted.
3. APNs delivery to that token from this point on returns 410 Gone (Apple's "unregistered" code) which is fine — the token is already gone server-side.
4. The next user to sign in on the same device registers a fresh token tied to *their* userid.

**Expected outcome**: Token leakage between user sessions on the same device is impossible. A second user never receives the first user's pushes.

---

## Functional Requirements

### FR-001 — Push token registry

Every push-eligible client (iOS app, Android app, web browser with notifications granted) MUST register a token at the server so the fanout worker can target it. Tokens rotate on uninstall, restore from backup, log out, or browser cache clear; the server MUST handle rotations and invalid-token errors cleanly.

**Acceptance Criteria**:

- [ ] `POST /api/push/tokens` body `{ deviceid, platform: "ios" | "android" | "web", token, appversion, locale }` — registers a token. `deviceid` is the same id used by spec 008 `mobiledevices` (mobile) or a browser-fingerprint UUID (web). One row per `(userid, deviceid, platform)` — re-registration with the same triple updates the existing row's `token` column
- [ ] `DELETE /api/push/tokens` body `{ deviceid }` — removes all tokens for the calling user on that device. Used on logout
- [ ] `GET /api/push/tokens` — list caller's registered tokens (token value redacted to last 6 chars). Surfaced in the user's notification settings screen
- [ ] When a provider returns an "unregistered" / "invalid token" / "410 Gone" error, the server hard-deletes the offending row from `pushtokens` immediately. The fanout worker handles this in-line; no separate cleanup job is needed for these
- [ ] Tokens older than 60 days with no successful delivery are pruned by a daily cleanup job — Apple and Google both consider stale tokens unreliable
- [ ] Token values are stored as-is (they are device-specific opaque strings, not credentials in the spec-001 sense). They are NEVER logged in plaintext beyond the last 6 chars

### FR-002 — Foreground-aware fanout worker

A push MUST only be sent when the user is NOT already receiving the event over a live WebSocket. The fanout worker reads spec 003's session registry and spec 008's `MobileLifecycle.currentState()` (reported by the client at each foreground/background transition) to decide.

**Decision matrix**:

| Client state | WS connected | Fanout decision |
| --- | --- | --- |
| Foreground (any platform) | Yes | No push — WS handles delivery |
| Foreground | No (just dropped) | No push — WS will reconnect within 30s |
| Background (mobile) | No | Push — silent or visible per type |
| App closed (mobile) | No | Push — visible |
| Browser tab hidden (web) | Yes (idle WS) | No push — JS still receives WS events |
| Browser closed | No | Push — Web Push if granted |

**Acceptance Criteria**:

- [ ] The fanout worker subscribes to the spec 003 `WSBroker` publish stream. Every event published is evaluated for push eligibility
- [ ] For each event, the worker queries spec 003 `wssessions` to find active sessions for the affected `user:{id}` scope. If at least one session has a `lastheartbeat` within 60 seconds and that session's client reported foreground state in the last 2 minutes, no push is sent
- [ ] Client foreground/background transitions are reported by `POST /api/push/lifecycle` with `{ deviceid, state: "foreground" | "background" }`. The server caches this in memory (or Redis in clustered mode) for the 2-minute decision window
- [ ] Multi-device: if user has phone (background) and laptop (foreground WS), the fanout worker DOES send a push to the phone — each device is evaluated independently
- [ ] Web Push: a browser tab in the background is treated as foreground for fanout purposes IF its WS is alive; if the browser process is killed, the WS drops and pushes resume
- [ ] Worker latency target: from `WSBroker` publish to push provider call ≤ 500ms p95 under normal load (spec 003 success criterion #1's 100ms is for in-app delivery; the extra budget here is for the fanout decision and provider RTT)

### FR-003 — Event-to-payload mapping

Not every WSEvent should produce a push. The mapping MUST be explicit, per-type, and tunable per-user via preferences (FR-007).

**Default mapping**:

| WSEvent type | Default push behaviour | Visible body | Deep link |
| --- | --- | --- | --- |
| `pa.notification` (briefing) | Visible | "Your morning briefing is ready" | `yappchat://pa/notification/:id` |
| `pa.notification` (calendar_reminder) | Visible, bypass quiet hours | "{title} starts in 15 min" | `yappchat://video/:roomid` or `yappchat://pa/notification/:id` |
| `pa.notification` (project_overdue) | Visible | "{taskname} is overdue" | `yappchat://pa/notification/:id` |
| `pa.notification` (email_alert) | Visible | "Email from {sender}" | `yappchat://pa/notification/:id` |
| `pa.notification` (pending_messages) | Throttled (1 per 30 min) | "{count} new messages" | `yappchat://pa/notification/:id` |
| `message.inbound` with mention of user | Visible (silent-then-fetch for E2E) | "{sender} mentioned you in {channel}" | `yappchat://conversation/:id?messageid=:mid` |
| `message.inbound` direct message to user | Visible (silent-then-fetch for E2E) | "{sender}: {preview}" | `yappchat://conversation/:id?messageid=:mid` |
| `message.inbound` (channel, no mention) | Per-channel preference (default off) | "New message in {channel}" | `yappchat://conversation/:id` |
| `message.delivery_status` | Never push | — | — |
| `message.typing_*` | Never push | — | — |
| `presence.*` | Never push | — | — |
| `videoroom.participant_joined` | Push only if user is invitee not yet joined | "{name} is in the call" | `yappchat://video/:id` |
| `videoroom.ended` | Never push | — | — |
| `subagent.status: completed` (spec 002 FR-015) | Visible | "Your subagent finished" | `yappchat://session/:parentsessionid` |
| `subagent.status: error` | Visible | "Your subagent failed" | `yappchat://session/:parentsessionid` |
| `subagent.status: working` / `spawned` / `waiting_for_input` | Never push | — | — |
| `skill.update_available` (spec 002 FR-006) | Never push (in-app only) | — | — |
| `mcp.server_status` | Never push | — | — |
| `directory.*` | Never push | — | — |
| `channel.health` | Never push | — | — |
| `agent.message` (spec 001 FR-010 dev agents) | Per-user opt-in (default off) | "{agent}: needs your input" | `yappchat://agent/:id` |

**Acceptance Criteria**:

- [ ] The mapping is implemented as a registry in `src/server/push/event-mappings.ts` — one entry per WSEvent type. Adding a new event type without a mapping defaults to no-push
- [ ] Each mapping entry exports: `eventType`, `shouldPush(event, userPrefs) → boolean`, `buildPayload(event, userLocale) → PushPayload`, `bypassQuietHours: boolean`, `throttle?: { perWindowMs, maxPerWindow }`, `deepLink: (event) → string`
- [ ] Throttle state is per-user, per-mapping, in-memory or Redis. Resets on a sliding window
- [ ] The server-side `WSBroker.publish` flow is unchanged — push fanout is a downstream subscriber, not in the publish path. A push failure NEVER prevents a WS delivery
- [ ] Localised body strings are loaded from a resource bundle keyed by the user's locale (from `mobiledevices.locale` or browser `Accept-Language`). English is the v1 baseline; the system supports additional locales without code changes

### FR-004 — APNs (iOS) provider adapter

iOS pushes MUST be delivered via Apple Push Notification service over HTTP/2 with token-based authentication.

**Acceptance Criteria**:

- [ ] Configuration: `APNS_AUTH_KEY` (.p8 file path or content), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` (matches spec 008 `com.wxperts.yappchat`), `APNS_ENVIRONMENT` (`development` | `production`)
- [ ] Adapter uses `@parse/node-apn` (or equivalent). Connection pooling with HTTP/2 keep-alive. Reconnect on idle drop
- [ ] Visible payload shape: `{ aps: { alert: { title, body }, sound: "default", "thread-id": <conversationid|sessionid|"pa"> }, link: <deeplink>, type: <eventType> }`
- [ ] Silent payload shape (E2E wake-and-fetch): `{ aps: { "content-available": 1 }, type: "wake-and-fetch", scope, eventid }` — no `alert` block, no `sound`. iOS delivers silently; the app's `BackgroundFetch` handler does the fetch + local notification
- [ ] Apple's silent-push throttling is acknowledged: the spec 002 PA monitoring loop (5-min default) means many silent pushes per user per day. The fallback path (FR-006) handles throttle rejections gracefully
- [ ] APNs response handling: `200` → success, log delivery time; `410` → delete token from `pushtokens`; `429` → exponential backoff and retry up to 3 times; `5xx` → retry with backoff, then give up after 3 attempts
- [ ] Per-environment routing: `APNS_ENVIRONMENT=development` targets `api.sandbox.push.apple.com`, `production` targets `api.push.apple.com`. EAS preview builds use development; EAS production builds use production. The shell tells the server which it is via the `apns_env` field on `pushtokens` registration

### FR-005 — FCM (Android, also iOS-via-FCM as fallback) provider adapter

Android pushes MUST be delivered via Firebase Cloud Messaging.

**Acceptance Criteria**:

- [ ] Configuration: `FCM_SERVICE_ACCOUNT_JSON` (path or content), `FCM_PROJECT_ID`. The service account has the `roles/firebasenotifications.admin` role only — no broader Firebase permissions
- [ ] Adapter uses `firebase-admin` SDK's `messaging.send()`. One project for all environments — environments are differentiated by topic prefix or token registration source, not separate Firebase projects
- [ ] Visible payload: `{ token, notification: { title, body }, data: { link, type, eventid }, android: { priority: "high", notification: { channel_id: "default" } } }`
- [ ] Silent payload (data-only for E2E wake-and-fetch): `{ token, data: { type: "wake-and-fetch", scope, eventid, link }, android: { priority: "high" } }` — no `notification` block; the app's data-handler renders a local notification with decrypted content
- [ ] Android notification channels (FCM Android 8+ requirement): `default` (general), `urgent` (calendar, mentions — bypass DND), `quiet` (low-priority message previews). Channels are registered by the mobile shell on first launch
- [ ] Battery whitelisting: Android OEM aggressive doze is acknowledged. The spec 008 onboarding flow already includes guidance to "disable battery optimisation for YappChat"; this spec emits a one-time PA notification to that effect when a high-priority push fails to wake the device (detected by missing client-side ack within 60s)
- [ ] Response handling: `messaging/registration-token-not-registered` → delete from `pushtokens`; `messaging/quota-exceeded` → backoff and retry; `messaging/server-unavailable` → retry 3 times then give up

### FR-006 — Silent-push-then-fetch with visible-push fallback

For E2E messages, the default path is **silent push** so the device wakes, fetches the ciphertext, and renders a *local* notification with the decrypted preview. Push providers never see plaintext. When the OS throttles silent pushes (Apple's daily silent budget, Android Doze), the worker falls back to a generic visible push.

**Acceptance Criteria**:

- [ ] For events where the source message has `encryptiontype: "e2e"` (or `"agent-e2e"`), the worker FIRST sends a silent payload. The payload contains `{ type: "wake-and-fetch", scope, eventid, link }` and no plaintext
- [ ] The mobile shell's notification handler (added in this spec) processes `wake-and-fetch` payloads: opens an authenticated WS, fetches the event payload via `GET /api/engine/messages/:id` (or `GET /api/pa/sessions/:id/messages?since=...`), decrypts client-side using the spec-001 key, then calls `Notifications.scheduleNotificationAsync` to render a local visible notification with the decrypted preview
- [ ] If the fetch + decrypt completes within 25 seconds of the silent push arriving, the local notification is rendered. The user sees ONE notification, not two
- [ ] Server-side fallback timer: 30 seconds after a silent push is sent, if no client-side ack callback (`POST /api/push/ack` from the app) has arrived for that `eventid`, the worker sends a generic visible push: title `"YappChat"`, body `"You have a new message"`, deep link to the relevant scope (no message preview). This catches throttled silent pushes without leaking content
- [ ] Generic-visible body strings are localised. They never include sender names, channel names, or content for E2E messages
- [ ] Non-E2E messages (`encryptiontype: "platform"` — Slack, Discord, etc.) skip the silent path and go straight to visible push with the platform-provided plaintext content
- [ ] Web Push always uses visible payloads — silent web push exists but is poorly supported across browsers; the complexity isn't worth it in v1. E2E content for web is fetched at the moment the user clicks the notification

### FR-007 — Notification preferences

Every user MUST be able to control which notification types push, set quiet hours, opt out of per-channel message pushes, and turn pushes off entirely.

**Acceptance Criteria**:

- [ ] `notificationpreferences` table — one row per user with: `pushenabled` (master switch), `quiethoursstart` (time), `quiethoursend` (time), `quiethourstimezone` (IANA), `pertypeprefs` (jsonb keyed by event type with `{ push: bool, sound: bool }`), `perchannelprefs` (jsonb keyed by channelid with `{ push: "all" | "mentions" | "off" }`)
- [ ] `GET /api/push/preferences` returns the caller's preferences with defaults filled in for any unset fields
- [ ] `PATCH /api/push/preferences` updates any subset of preferences. Takes effect on the next event
- [ ] Quiet hours timezone defaults to the most recently registered device's timezone (`mobiledevices.timezone`). User can override
- [ ] Quiet hours respected by the fanout worker; the per-mapping `bypassQuietHours: true` flag overrides for calendar reminders only (FR-003 mapping)
- [ ] Per-channel preferences for `message.inbound`: `"all"` (push every message), `"mentions"` (only when user is mentioned — default for shared channels), `"off"` (never push for this channel — DM channels stay on by default)
- [ ] Suppressed-during-quiet-hours pushes are NOT replayed when quiet hours end. The events remain readable in-app via WS replay or REST refresh; this avoids a morning flood
- [ ] A "Test push" action in settings sends a sample push to all of the user's registered tokens — used to verify a new device is correctly wired

### FR-008 — Tap-target dispatch

Tapping a push MUST open YappChat to the correct surface using spec 008's `DeepLinkRouter` (mobile) or a service-worker-registered URL handler (web).

**Acceptance Criteria**:

- [ ] Every push payload includes a `link` field in the form `yappchat://...` (mobile) or `https://yappchat.app/...` (web universal link)
- [ ] Mobile: when the user taps a notification while the app is open, the in-app handler reads the `link` and dispatches to spec 008's `DeepLinkRouter` directly — no need to round-trip through the OS
- [ ] Mobile cold start: tapping a push launches the app with the deep link; spec 008 `DeepLinkRouter` reads `Linking.getInitialURL()` and navigates before the first render (already covered by spec 008 FR-007)
- [ ] Web: the service worker registered for Web Push intercepts the click event, calls `clients.openWindow(link)` to focus or open a tab on that URL
- [ ] Each tap is recorded as `pushtaps` with `{ pushid, userid, deviceid, eventtype, tappedat }` so engagement analytics can be derived per type. Records are pseudonymous (userid only) and rolled up monthly; raw rows are pruned after 90 days
- [ ] If the deep-linked resource no longer exists (deleted message, ended video room) the target surface shows a friendly empty state; the app does not crash or render an error toast

### FR-009 — Web Push provider adapter

Browsers (Chrome, Edge, Firefox, Safari 16+) MUST be able to receive pushes when the YappChat tab is closed. Web Push uses the Web Push Protocol with VAPID authentication.

**Acceptance Criteria**:

- [ ] VAPID keys generated once per environment and stored in EAS-equivalent server secrets (`WEBPUSH_VAPID_PUBLIC_KEY`, `WEBPUSH_VAPID_PRIVATE_KEY`, `WEBPUSH_VAPID_SUBJECT`)
- [ ] Public key is exposed via `GET /api/push/webpush/vapid-public-key` so the client can subscribe
- [ ] Browser flow: client requests notification permission, calls `serviceWorker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, posts the resulting `PushSubscription` (endpoint, p256dh, auth) to `POST /api/push/tokens` with `platform: "web"`
- [ ] A service worker (`apps/web/public/sw.js`) handles `push` events: parses the encrypted payload, renders `self.registration.showNotification(title, options)`, and handles `notificationclick` events by opening the deep link
- [ ] Server uses the `web-push` npm package to send: `webpush.sendNotification(subscription, payload, { vapidDetails })`. Payload is encrypted client-side per the Web Push Protocol
- [ ] On `410` or `404` responses from the push endpoint, delete the row from `pushtokens` (subscription expired)
- [ ] Web Push payload size cap is ~4KB across browsers — the fanout worker truncates payloads if needed and includes a deep link to fetch the full content on click

### FR-010 — Acknowledgement and analytics

Push delivery MUST be observable. Every send and tap is logged so operators can debug delivery failures and measure engagement.

**Acceptance Criteria**:

- [ ] `pushdeliveries` table — one row per push send: `id`, `userid`, `deviceid`, `tokenid` (FK → pushtokens), `eventtype`, `eventid` (the originating WSEvent id), `payloadkind` (`silent` | `visible` | `fallback-visible`), `provider` (`apns` | `fcm` | `webpush`), `status` (`sent` | `delivered` | `failed`), `errormessage`, `latencyms`, `sentat`. Retained 30 days
- [ ] `POST /api/push/ack` (called by the mobile shell when a silent push is received and the fetch completes) updates the matching `pushdeliveries` row to `status: "delivered"` with `deliveredat`. Used by the fallback timer (FR-006) and engagement analytics
- [ ] `GET /api/push/stats` (admin only) returns aggregate stats: send counts by provider, delivery success rate, p50/p95 latency, fallback rate, taps per type. Powers a dashboard
- [ ] Provider error rates above thresholds (>5% APNs `BadDeviceToken`, >10% FCM unavailable) trigger a PA notification to `andy@wxperts.com` (matching spec 003's pattern). Alert dedup: 1 per 24h per provider
- [ ] Per-user delivery history is NOT exposed via API — operators see aggregates only. Individual debug records are accessible via direct DB query under explicit support workflow

### FR-011 — Server-side rate limiting and abuse prevention

A misbehaving event publisher (or a compromised account) MUST NOT be able to send unbounded pushes to a user.

**Acceptance Criteria**:

- [ ] Per-user push budget: max 60 pushes per hour per user. Excess is dropped (not queued) with a warn log. This is the hard ceiling — well above any expected legitimate volume
- [ ] Per-event-type throttle (FR-003 `throttle` field) applied first; the per-user budget catches abuse across types
- [ ] If a user hits the per-user budget more than 3 times in 24h, the worker auto-pauses pushes for that user for 1 hour and posts a PA channel notification: "Pushes paused due to unusually high volume — investigate"
- [ ] Per-deployment global cap: max 10,000 pushes per minute across all users — protects against a runaway publisher. Enforced as a soft drop; events still flow over WS
- [ ] All cap and budget values are env-tunable

---

## Data Requirements

| Table | Purpose |
| --- | --- |
| `pushtokens` | One row per user-device-platform — APNs, FCM, or Web Push subscription details |
| `notificationpreferences` | Per-user push preferences — quiet hours, per-type, per-channel mute |
| `pushdeliveries` | Audit log of every push send — 30-day retention |
| `pushtaps` | Audit log of every push tap — 90-day retention, pseudonymous |

### `pushtokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user |
| `deviceid` | text | Same as spec 008 `mobiledevices.deviceid` (mobile) or browser-fingerprint UUID (web) |
| `platform` | text | `"ios"` \| `"android"` \| `"web"` |
| `token` | text | APNs device token, FCM registration token, or Web Push endpoint URL |
| `webpushp256dh` | text | Nullable — Web Push P-256 public key |
| `webpushauth` | text | Nullable — Web Push auth secret |
| `apnsenv` | text | Nullable — `"development"` \| `"production"` (iOS only) |
| `appversion` | text | Mobile app version (mobile only); browser UA (web) |
| `locale` | text | BCP 47 — e.g., `"en-US"` |
| `lastusedat` | timestamptz | Updated on every successful send |
| `lastfailedat` | timestamptz | Nullable — most recent provider failure |
| `failurecount` | integer | Increments on transient failures, resets on success |
| `createdat` | timestamptz | |

UNIQUE constraint on `(userid, deviceid, platform)`.
Index on `(userid)` — primary lookup at fanout time.

### `notificationpreferences`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | UNIQUE |
| `pushenabled` | boolean | Master switch — default true |
| `quiethoursstart` | time | Nullable — local time start of quiet hours (e.g., `22:00`) |
| `quiethoursend` | time | Nullable — local time end of quiet hours (e.g., `07:00`) |
| `quiethourstimezone` | text | IANA — e.g., `"America/Denver"` |
| `pertypeprefs` | jsonb | Keyed by event type — `{ "pa.notification.briefing": { push: true, sound: true }, ... }` |
| `perchannelprefs` | jsonb | Keyed by channelid — `{ "<channelid>": { push: "mentions" \| "all" \| "off" } }` |
| `updatedat` | timestamptz | |

### `pushdeliveries`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `deviceid` | text | |
| `tokenid` | uuid | FK → pushtokens.id |
| `eventtype` | text | The WSEvent type that triggered the push |
| `eventid` | uuid | FK → spec 003 wsevents.id (nullable if event has expired from the WS log) |
| `payloadkind` | text | `"silent"` \| `"visible"` \| `"fallback-visible"` |
| `provider` | text | `"apns"` \| `"fcm"` \| `"webpush"` |
| `status` | text | `"sent"` \| `"delivered"` \| `"failed"` |
| `errormessage` | text | Nullable |
| `latencyms` | integer | Time from `WSBroker.publish` to provider call return |
| `sentat` | timestamptz | |
| `deliveredat` | timestamptz | Nullable — set on `POST /api/push/ack` |
| `expiresat` | timestamptz | `sentat + 30 days` — cleanup job |

Index on `(userid, sentat DESC)` for delivery history queries.
Index on `(eventid)` for the fallback-timer lookup.

### `pushtaps`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `pushdeliveryid` | uuid | FK → pushdeliveries.id |
| `userid` | text | |
| `deviceid` | text | |
| `eventtype` | text | |
| `tappedat` | timestamptz | |
| `expiresat` | timestamptz | `tappedat + 90 days` |

---

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/push/tokens` | Register a token — body `{ deviceid, platform, token, webpushp256dh?, webpushauth?, apnsenv?, appversion, locale }` |
| DELETE | `/api/push/tokens` | Remove all tokens for caller on a device — body `{ deviceid }` |
| GET | `/api/push/tokens` | List caller's registered tokens (token redacted) |
| POST | `/api/push/lifecycle` | Client lifecycle ping — body `{ deviceid, state: "foreground" \| "background" }` |
| POST | `/api/push/ack` | Client ack of a silent push — body `{ eventid, deviceid, deliveredat }` |
| POST | `/api/push/tap` | Client report of a tap — body `{ pushdeliveryid }` |
| GET | `/api/push/preferences` | Caller's push preferences |
| PATCH | `/api/push/preferences` | Update preferences — any subset of fields |
| POST | `/api/push/test` | Send a sample test push to all caller's tokens |
| GET | `/api/push/webpush/vapid-public-key` | VAPID public key for Web Push subscription |
| GET | `/api/push/stats` | Admin only — aggregate delivery stats |

---

## Frontend Components

This spec is mostly server-side. The client surface is small.

### Client-side handlers

| Module | Path | Description |
| --- | --- | --- |
| `PushHandler` (mobile) | `apps/mobile/src/PushHandler.tsx` | Mounts inside spec 008's `MobileRoot`. Subscribes to `expo-notifications` events. Handles foreground notifications, taps, and silent `wake-and-fetch` payloads. Dispatches taps to spec 008 `DeepLinkRouter`. |
| `PushSubscription` (web) | `apps/web/src/push-subscription.ts` | Subscribes the browser to Web Push when permission is granted, posts the subscription to `/api/push/tokens`. |
| Service worker | `apps/web/public/sw.js` | Handles `push` events (renders `showNotification`) and `notificationclick` events (opens deep link). |

### Settings UI

| Component | Path | Description |
| --- | --- | --- |
| `NotificationSettingsScreen` | `packages/ui/src/notifications/NotificationSettingsScreen.tsx` | Master switch, quiet hours picker (start time, end time, timezone), per-type toggles grid, per-channel preferences list, "Test push" button, registered devices list. Used on web and mobile via shared component library (spec 008 FR-002). |
| `QuietHoursPicker` | `packages/ui/src/notifications/QuietHoursPicker.tsx` | Time-range picker with timezone select. |
| `PerTypePreferencesGrid` | `packages/ui/src/notifications/PerTypePreferencesGrid.tsx` | Toggle grid for each event type with a friendly label and a description of when it fires. |
| `PerChannelPreferencesList` | `packages/ui/src/notifications/PerChannelPreferencesList.tsx` | Per-channel "all / mentions / off" picker. |
| `RegisteredDevicesList` | `packages/ui/src/notifications/RegisteredDevicesList.tsx` | Shows where YappChat is installed and receiving pushes. Each row has a "Sign out from this device" action. |

---

## Success Criteria

1. Time from `WSBroker.publish` to lock-screen banner ≤ 5 seconds p95 for `pa.notification` (briefing) on iOS and Android.
2. Foreground users never receive a push for an event they are already getting over WS.
3. E2E messages arrive as silent push followed by a local notification with decrypted preview within 4 seconds; the push provider's logs contain no plaintext content.
4. Silent-push throttling triggers the visible-push fallback within 30 seconds for any silent push that goes unacknowledged.
5. Tapping a push opens YappChat to the correct surface 100% of the time for the deep-link patterns in FR-003.
6. Quiet hours suppress non-bypass pushes during the configured window in the user's chosen timezone; calendar reminders still deliver.
7. Logout clears all push tokens for the device — the next user receives only their own pushes.
8. Per-user push budget caps at 60/hour without disrupting WS delivery of the same events.
9. Provider error rate dashboards exist; threshold alerts fire to `andy@wxperts.com` at most once per 24h per provider.
10. Web Push reaches a closed-tab user on Chrome, Edge, Firefox, and Safari 16+ within 5 seconds.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `PushToken` | `pushtokens` | One device's notification subscription — APNs token, FCM token, or Web Push subscription. |
| `NotificationPreferences` | `notificationpreferences` | Per-user push controls — master switch, quiet hours, per-type, per-channel. |
| `PushDelivery` | `pushdeliveries` | Audit row per send — used for engagement analytics, fallback timing, and operator dashboards. |
| `PushTap` | `pushtaps` | Audit row per tap — pseudonymous, 90-day retention. |
| `EventToPushMapping` | `src/server/push/event-mappings.ts` | Code-level registry mapping each `WSEvent` type to its push behaviour, payload shape, and deep link. |

---

## Constraints

- A push MUST NEVER contain plaintext content for messages with `encryptiontype: "e2e"` or `"agent-e2e"`. The silent-push-then-fetch path is mandatory; the visible fallback uses generic copy only.
- Push delivery is best-effort. WS remains the authoritative delivery path. A push failure NEVER prevents or affects the WS delivery of the same event.
- The fanout worker is a downstream subscriber of `WSBroker`. Its latency does not count against spec 003's 100ms in-app delivery target.
- Tokens MUST be deleted from `pushtokens` immediately on provider "unregistered" / 410 / `BadDeviceToken` responses. Stale tokens accumulate cost and noise.
- Quiet-hours-suppressed pushes MUST NOT be replayed when quiet hours end. The events are still readable via WS replay or REST refresh; replay would create a notification flood.
- Per-user push budget (60/hour) is a hard ceiling — abuse paths cannot bypass it.
- Provider keys (APNs auth key, FCM service account JSON, VAPID private key) MUST be stored in server secrets — never committed.
- Web Push payloads MUST stay under 4KB to work across browsers; deep link to fetch full content if the payload would exceed this.
- Service worker code (web) is the only client-side code path that runs without the YappChat app being open. It MUST NOT contain auth credentials, decryption keys, or business logic — its job is to render the notification and route the click.

---

## Notes

### Why not topic-based push

FCM supports topic subscriptions (e.g., subscribe to `org-{orgid}` and the server publishes once to the topic). This sounds attractive but breaks down under YappChat's per-user preference model — the server would have to filter at the topic publisher, defeating the topic. Per-user direct sends to known tokens are the pattern; FCM/APNs handle the fan-out at their end.

### Linking with spec 003

Spec 003 owns the WSEvent envelope and the `WSBroker` publish bus. This spec is a downstream subscriber. The push fanout worker runs in the same process as the broker in v1 (`LocalBroker`); when spec 003 switches to `RedisBroker` for horizontal scale, the fanout worker can run on its own host subscribed to the same Redis pub/sub channel.

### Linking with spec 008

Spec 008 owns the `mobiledevices` table, the `MobileLifecycle` event source, the `DeepLinkRouter`, and the `expo-notifications` capability. This spec consumes all four:

- `mobiledevices.deviceid` is the join key for `pushtokens`
- `MobileLifecycle.currentState()` reports foreground/background to `POST /api/push/lifecycle`
- `DeepLinkRouter` handles the tap-target dispatch
- `expo-notifications` is wired here (the shell installed it)

### Linking with spec 011 (Auth)

Token registration requires authentication via spec 011 — `POST /api/push/tokens` requires a valid session. Logout (spec 011 FR-007) calls `DELETE /api/push/tokens` for that device in the same atomic sequence as `SecureKeyStore.clearUser` (spec 008 FR-004), so a second user on the same device starts with a fresh token. This satisfies spec 011's "logout completeness" requirement.

Push fanout decisions (FR-002) use `MobileLifecycle.currentState()` (spec 008 FR-003) to decide whether the user is foregrounded. The `deviceid` join key matches across `pushtokens` ↔ `mobiledevices` (spec 008) ↔ `devicesessions` (spec 011 FR-014) ↔ `userencryptionkeys` (spec 001) ↔ `keypairings` (spec 010).

### Risks

- **Apple silent-push budget**: APNs has an undocumented daily silent-push budget per app per device. Heavy use (e.g., a chatty group channel) can hit it; the visible-push fallback (FR-006) catches this but produces less informative notifications when triggered.
- **Android Doze on aggressive OEMs**: Xiaomi, Samsung, OPPO, and others implement aggressive battery management beyond stock Android. Even high-priority FCM pushes can be delayed for 10+ minutes. Mitigation: user-facing guidance to whitelist YappChat (delivered as a one-time PA notification on first delivery failure).
- **Service worker lifecycle on web**: browsers can evict service workers under memory pressure. The first push after a long idle may take an extra second to launch the worker. Acceptable.
- **Token-rotation lag**: when iOS restores from backup, the device gets a new APNs token. The previous token still works briefly. The server may send to both for a short window, costing a small number of duplicate sends. Acceptable.
- **Cost**: APNs is free; FCM is free at the volumes anticipated; Web Push uses browser-vendor infrastructure for free. There is no per-message billing risk in v1.
- **GDPR / data residency**: push tokens and delivery logs are personal data. Retention windows (30 days for `pushdeliveries`, 90 days for `pushtaps`) reflect a balance between debugging value and minimisation. The privacy policy (separate doc) must reflect these.
- **Notification permission denial**: a user who denies notifications cannot be re-prompted automatically by the OS. The settings screen surfaces a "You denied notifications — open Settings to enable" path, identical to spec 008 FR-005's denied-permission UX.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Which push providers in v1? | APNs (iOS), FCM (Android), Web Push with VAPID (browsers). All three are free at expected v1 volumes. |
| 2 | How is E2E content protected? | Silent push + fetch + local notification. Fallback to generic visible push if silent is throttled. Push providers never see plaintext for E2E messages. |
| 3 | Foreground users — push or not? | Not. The fanout worker queries the user's WS sessions and skips push if a foreground session is alive. |
| 4 | What controls quiet hours timezone? | The user, defaulting to the most recently registered device's timezone. |
| 5 | Are quiet-hours-suppressed pushes replayed when quiet hours end? | No. Events stay readable via WS / REST. Replay would cause morning floods. |
| 6 | Topic-based push? | No — per-user direct sends only. Topics defeat per-user preference filtering. |
| 7 | Push for typing indicators or presence? | Never. Default mapping in FR-003 excludes these explicitly. |
| 8 | Per-user rate ceiling? | 60 pushes/hour. Hard cap. Repeated breaches auto-pause pushes for that user with operator alert. |
| 9 | Mobile bare native vs Expo? | Already decided in spec 008 — Expo with custom dev client. This spec uses `expo-notifications` for iOS/Android delivery handlers. |
| 10 | Where does the fanout worker live in v1? | In-process with the WS engine (LocalBroker subscriber). Moves to its own process behind RedisBroker when spec 003 horizontal-scales. |
