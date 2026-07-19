# SCOPE-089: In-Call Screen Share & Give-Control + Desktop Shell

**Scope Number**: 089
**Status**: `draft`
**Created**: 2026-07-18
**Last Reviewed**: 2026-07-18
**Depends On**: SPEC-087 (1:1 DM audio/video calls — the call overlay this extends), SPEC-088 (Remote screen control in DMs — consent, single-use token, WS input relay, native agent this reuses), SPEC-071 (Presentations — LiveKit screen-share media pattern), SPEC-018 (Contacts & DMs — the P2P entry point), SPEC-003 (WebSocket engine — realtime control channel), SPEC-011 (auth — session-token minting), SPEC-008 (Mobile/desktop shell — the Electron desktop client this begins)
**Source**: `specs/Project-Scope/089-in-call-screen-share-and-control.md`

## Overview

During a **1:1 DM audio/video call** (spec 087), a participant can **share a screen** and — from inside the same call — **give the other person control** of it, then **revoke** it. This closes the two gaps that made calls only "80% there": there was no way to share a screen in a plain call, and the existing remote-control feature (spec 088) lived in a separate overlay unreachable from a call.

**Screen share** is pure LiveKit — publishing the display as a video track on the existing `dm-call-<id>` room. It needs **no download in any environment** and offers **select a screen**, **switch screens**, and **cancel share**. **Giving control** reuses **all** of spec 088's machinery unchanged — per-session consent, single-use token, `remotecontrol:{sessionId}` WS input relay, pause/panic/audit — but the controller now drives the screen **already shared in the call** rather than a second share on a separate room.

Because a browser tab cannot inject OS input, actual control still needs a native injector. This scope also **scaffolds the Electron desktop client** (`apps/desktop`, previously only a `stack.md` stub) as a minimal shell that loads the deployed web UI and injects input **in-process** via the shared nut.js core — so on desktop, giving control needs **no download**. In a plain browser, giving control **falls back** to the existing spec 088 downloadable agent.

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | Sharer — a signed-in YappChat user in a 1:1 call who shares a screen and may give control of it to the other party. |
| **Secondary Actors** | Controller (the call peer) — views the shared screen and, once given control, drives its mouse/keyboard; the DM call (spec 087) whose LiveKit `dm-call-<id>` room carries the media; the remote-control session/consent/token/WS machinery (spec 088) that governs control; the native injector — the Electron desktop main process (in-app, no download) or the fallback downloadable agent (browser); the realtime WS engine (spec 003) carrying the control channel. |
| **Key Value** | Share a screen and hand over the mouse **without leaving the call** — no second overlay, no second screen pick, and on the desktop app, no download at all. Reuses the trusted consent/kill-switch/audit model already shipped. |

## Business Problem

Spec 087 shipped 1:1 audio/video calls, and users report them working ~80%: the video is fine, but two expected controls are missing. First, there is **no "Share Screen"** in a call — you can only send camera video, so you cannot show a document, an app, or a workflow while talking. Second, spec 088's **"Give Control" / "Revoke control"** exists and works, but only in its own DM-header overlay on a separate LiveKit room — it is **not reachable from inside a call**, so a natural "let me just drive for a second" hand-off during a call is impossible without dropping into a different flow that re-shares the screen.

Both gaps are wiring, not new machinery: LiveKit screen-share publishing already exists (specs 071/088), and the entire consent/token/relay/agent path from spec 088 is built and verified. What is missing is (a) a screen-share affordance in the call control bar and (b) surfacing give/revoke control inside the call against the call's own shared screen. The one genuinely new build is the **Electron desktop shell**, which removes the download step for control — the desktop app itself becomes the native injector, reusing the agent's nut.js code.

## Actors

- Primary: Sharer — signed-in user in a 1:1 call who shares a screen and may give control of it to the peer, and can switch/cancel the share and revoke control at any time.
- Secondary: Controller (call peer) — views the shared screen and, once given control, captures and drives mouse/keyboard over the call's shared-screen video.
- Secondary: DM call (spec 087) — the active 1:1 call whose LiveKit `dm-call-<id>` room already carries camera+mic and now also the screen-share track.
- Secondary: Remote-control machinery (spec 088) — the session record, per-session consent, single-use token, `remotecontrol:{sessionId}` WS input relay, pause/panic, and audit, reused unchanged.
- Secondary: Native injector — the Electron desktop main process (in-app, no download) or, in a browser, the fallback downloadable agent (`apps/agent`).
- Secondary: Realtime WebSocket engine (spec 003) — carries the control channel (input events + session status).

## Scope Boundary

**IN (v1):** In a 1:1 DM **call** (spec 087): a **Share Screen** control (select a screen via the native picker, **switch** the shared screen, **cancel/stop** sharing) publishing a `ScreenShare` track on the existing `dm-call-<id>` room, **no download**; the call's remote render distinguishing screen-share (full-frame) from camera (PiP); a **Give Control** / **Revoke Control** affordance shown to the sharer while sharing (host-initiated via a **new `/control/offer` route** that reuses spec 088's session/token service; the sharer's click is the consent act), reusing spec 088's token/WS relay/pause/panic/audit, with the controller driving the **call's shared screen track** (no second `rc-` room); **environment-aware injection** — Electron desktop injects **in-process** (no download), browser **falls back to the spec 088 agent download**; a **minimal Electron desktop shell** (`apps/desktop`) that loads the deployed web UI and injects input in-process via a shared nut.js core extracted from `apps/agent`.

**OUT (v1):** Screen share / give-control in **group DMs, communities, or conference rooms** (087 multi-party); multiple simultaneous sharers in one call; a custom in-app thumbnail screen picker (v1 uses the native `getDisplayMedia`/OS picker); macOS/Linux native injection (Windows-only, inherited from spec 088); giving control from a **browser without** the fallback agent; the rest of the desktop client from `stack.md` — **offline SQLite cache, auto-update, and signed per-OS installers** (deferred to a later desktop scope); clipboard sync, file transfer, and unattended access (already out per spec 088).

## Out of Scope

The full desktop client per `apps/desktop/stack.md` (this ships a **minimal runnable shell** for native injection only — no SQLite offline store, no auto-update, no packaged/signed installer); a custom screen-picker UI (native picker only); control on any surface other than a 1:1 call's shared screen; any control path that skips spec 088's per-session consent.

## User Scenarios & Testing

### US1 — Share a screen during a call (happy path)

**Actor**: Sharer + peer, both in an active 1:1 call

**Scenario**:
1. Two users are in an accepted 1:1 call (camera + mic live).
2. Sharer clicks **Share Screen** in the call control bar → the native picker opens → they pick a display/window.
3. The peer's call view switches: the shared screen renders full-frame, the sharer's camera demotes to the PiP.
4. Sharer clicks **Switch** → the picker reopens → they pick a different screen; the peer's view follows.
5. Sharer clicks **Stop share** (or cancels the picker) → the screen track ends, the view reverts to camera-full-frame.

**Expected outcome**: No download at any point; the shared screen appears to the peer within ~1–2s of selection; switching swaps the source without ending the call; cancelling the picker is a clean no-op; only one screen-share track exists at a time.

### US2 — Give and revoke control during the call

**Actor**: Sharer (gives control) + Controller (the peer)

**Scenario**:
1. Sharer is sharing a screen in the call. A **Give Control** button is visible to the sharer.
2. Sharer clicks **Give Control** → the peer receives spec 088's per-session consent prompt.
3. On the peer's side (in a call this is the *sharer* who consents to be controlled per spec 088's model — the sharer is the host): control is granted, a persistent "controlling your screen" banner shows, and the button flips to **Revoke Control**.
4. The controller's pointer/keyboard over the call's shared-screen video drive the sharer's machine (normalized coordinates → native injection).
5. Sharer clicks **Revoke Control** (or panic hotkey, or moves their own mouse to auto-pause) → input stops; the button returns to **Give Control**; the screen share continues.

**Expected outcome**: No input is injected before consent; control drives the **call's existing shared screen** with no second share/room; revoke/panic cuts input within ~1s without ending the screen share or the call; every session is audited (spec 088 FR-014).

### US3 — Give control on the desktop app (no download)

**Actor**: Sharer running the Electron desktop app + Controller (browser or desktop)

**Scenario**: The sharer is in the desktop client. They share a screen and click **Give Control**; the peer accepts. Instead of downloading the agent, the desktop app injects input in-process.

**Expected outcome**: Control activates with **no download and no separate process** on the sharer's machine; injection, pause/panic, and revoke behave identically to the agent path; closing the app or revoking ends control immediately (fail-closed).

### US4 — Give control from a browser (agent fallback)

**Actor**: Sharer running the web app in a browser + Controller

**Scenario**: The sharer is in a plain browser (not Electron). They share a screen and click **Give Control**; the flow falls back to spec 088 — download and launch the helper agent, which injects input for the session.

**Expected outcome**: Identical control experience to the desktop path, with the one added step of the agent download/launch; token is single-use and session-bound; agent self-terminates on end (spec 088 FR-006/FR-012).

### US5 — Degraded / edge conditions

**Actor**: Sharer + Controller

**Scenario**: Peer declines the control prompt; the screen share is stopped mid-control; the call drops; both parties try to share at once; the picker is cancelled.

**Expected outcome**: Decline → no control channel opens, share continues. Stopping the share or dropping the call ends any active control (fail-closed, spec 088 FR-012). A second share request while one is active is rejected or replaces the first (last-clicker wins, single track). Picker-cancel is a clean no-op.

## Functional Requirements

### Screen sharing in a call (new)
- **FR-001** — In an active 1:1 call, either party may **share a screen**, publishing a `Track.Source.ScreenShare` track on the existing `dm-call-<id>` LiveKit room. No download in any environment.
- **FR-002** — Selecting a screen uses the **native picker** (`getDisplayMedia` via LiveKit `setScreenShareEnabled(true)`); there is no custom in-app picker in v1.
- **FR-003** — The sharer can **switch** the shared screen (re-open the picker and swap the source) and **cancel/stop** sharing at any time without ending the call. Cancelling the picker is a clean no-op.
- **FR-004** — The peer's call view **distinguishes** the screen-share track (rendered full-frame) from the camera track (demoted to PiP). At most **one** screen share exists in a call at a time (last-clicker wins).

### Give / revoke control in a call (reused machinery, new wiring)
- **FR-005** — While a participant is sharing a screen in the call, a **Give Control** affordance is shown to that **sharer (the host)**; it flips to **Revoke Control** while control is granted. The sharer's click **is the consent act** (host-initiated), so the peer is offered control directly rather than the peer requesting it.
- **FR-005a** — Host-initiated giving is delivered by **one new route** `POST /api/dm/:conversationId/control/offer` that reuses spec 088's session service: it creates a session with the caller as **host** and the peer as **controller**, already host-consented (status `agent_pending`), mints the single-use token, and notifies the peer (WS) to enter the controller surface. This is the **only** server addition; all other spec 088 routes/relay/audit are reused unchanged.
- **FR-006** — Once offered, control reuses spec 088 **unchanged**: single-use token, `remotecontrol:{sessionId}` WS input relay, pause, global panic hotkey, fail-closed teardown, and server-side audit. (The only bypass is the controller-request → host-allow handshake, replaced by the host-initiated offer per FR-005/FR-005a.)
- **FR-007** — The controller drives the **call's already-shared screen track** — normalized `[0,1]` pointer/keyboard captured over the call's shared-screen video — with **no second share and no separate `rc-<sessionId>` LiveKit room**.
- **FR-008** — Stopping the screen share, dropping the call, revoke, or panic **ends control** and invalidates the token (fail-closed), never leaving standing access.

### Environment-aware injection
- **FR-009** — When the sharer is running the **Electron desktop app**, giving control injects input **in-process** in the main process (shared nut.js core) with **no download and no separate agent process**.
- **FR-010** — When the sharer is in a **browser**, giving control **falls back** to the spec 088 flow — download and launch `apps/agent`, which injects input for the session.
- **FR-011** — The renderer **detects the environment** (an Electron-injected bridge flag) to choose the injection path; the server-side session/token/relay is **identical** for both (the Electron main connects to the same agent WS handshake as the standalone agent).

### Desktop shell (new, minimal)
- **FR-012** — A **minimal Electron shell** (`apps/desktop`) with a main + preload process loads the **deployed web UI** (dev → `localhost:5175`) in a single window and is runnable via the workspace dev script.
- **FR-013** — The agent's nut.js injection + outbound-WS agent loop is extracted from `apps/agent/src/agent.mjs` into a **shared `injection-core` module** imported by **both** the standalone agent (unchanged behavior) and the Electron main process.
- **FR-014** — `preload.ts` exposes a **context-isolated bridge** (`window.yappchatDesktop`) advertising `isDesktop` and start/stop-control IPC; on grant, the renderer hands the single-use token to main, which opens the **same** `?controltoken=…` agent WS connection the standalone agent uses.
- **FR-015** — The desktop shell v1 **defers** offline SQLite, auto-update, and signed/packaged installers (later desktop scope); it exists to serve in-app native injection and run the web UI.

## Data Requirements

- **No new tables or migrations.** Reuses spec 088's `remotecontrolsessions` + `remotecontrolaudit`, spec 087's call rooms/tokens, spec 018 `conversations`/`conversationmembers`, and spec 011 `users`.
- The screen-share track carries no persisted state; sharing status is LiveKit track presence + existing WS call/control events.

## API Routes

- **One new route:** `POST /api/dm/:conversationId/control/offer` — host-initiated give-control (FR-005a). Caller = host, peer = controller; creates an already-host-consented session (`agent_pending`), mints the single-use token, returns the token + agent download URL, and emits `remotecontrol.updated` so the peer enters the controller surface. Reuses spec 088's `remotecontrol/service.ts` session/token logic.
- **Reused unchanged (spec 088):** `/api/dm/:conversationId/control/{stop,sessions}` + `/:sessionId` status; browser fallback reuses `/api/agent/download`. (`request`/`allow`/`decline` remain for the DM-header flow but are bypassed by the in-call offer.)
- Screen share is client-side LiveKit on the existing `dm-call-<id>` room and its spec 087 token route — no route.
- The Electron main process authenticates to the **existing** agent WS handshake (`?controltoken=…`) — **no server change**.

## Frontend Components

- **`DmCall.tsx` (spec 087)** — extended: add **Share Screen / Switch / Stop share** controls and a **Give Control / Revoke Control** control; add `sharing` + screen-track state; branch `TrackSubscribed` on `Track.Source.ScreenShare` vs `.Camera` (screen full-frame, camera PiP).
- **In-call control-input capture** — lifted from `RemoteControlStage.tsx`: normalized pointer/keyboard capture over the call's shared-screen `<video>`, emitting `control_input` on the `remotecontrol:{sessionId}` scope.
- **Consent prompt / banner / panic** — reused from spec 088 (`RemoteControlPanel` pieces), surfaced within the call context.
- **`apps/desktop`** — Electron `main.ts` (BrowserWindow → deployed URL; IPC `control:start`/`control:stop` → `injection-core`), `preload.ts` (`window.yappchatDesktop` bridge), `package.json`.
- **`apps/agent`** — refactored to import the shared `injection-core`; standalone behavior unchanged.

## Success Criteria

1. In a 1:1 call, a participant can share a screen, switch it, and stop it, with **no download**, and the peer sees the shared screen full-frame with camera in PiP. — *FR-001..FR-004*
2. From inside the call, the sharer can **Give Control** and **Revoke Control**; the controller drives the call's shared screen with **no second share/room**. — *FR-005, FR-007*
3. Giving control enforces spec 088's consent, kill switch, panic, and audit unchanged; revoke/panic cuts input within ~1s without ending the share or call. — *FR-006, FR-008*
4. On the **desktop app**, giving control injects in-process with **no download**; in a **browser**, it falls back to the agent download — same control experience. — *FR-009, FR-010, FR-011*
5. The Electron shell runs the web UI from the deployed URL and injects input via the shared `injection-core`, with the standalone agent still working from the same module. — *FR-012, FR-013, FR-014*
6. No new tables or migrations; exactly **one** new server route (host-initiated `/control/offer`), reusing spec 088's session/token service; the desktop shell defers SQLite/auto-update/installers. — *Data/API sections, FR-005a, FR-015*

## Key Entities

- **Call screen share** — a `ScreenShare` LiveKit track published on the call's `dm-call-<id>` room; at most one per call.
- **In-call control session** — a spec 088 control session (unchanged) whose controller drives the call's shared-screen track instead of a separate `rc-` room.
- **Injection core** — the shared nut.js + outbound-WS module used by both the standalone agent and the Electron main process.
- **Desktop bridge** — the context-isolated `window.yappchatDesktop` surface that advertises the desktop environment and starts/stops in-process injection.

## Constraints

- Browsers cannot inject OS input → native injector (Electron main or fallback agent) is mandatory for control; screen **share/view** is browser-native.
- Windows-only native injection in v1 (inherited from spec 088; nut.js).
- Screen-share **track kind** must be distinguished on the receive side so screen renders full-frame and camera stays PiP.
- v1 uses the **native** screen picker; no custom thumbnail UI.
- Electron shell is **minimal** — loads the deployed URL, no offline store / auto-update / signed installer in this scope.
- Reuses spec 088 tokens/consent/relay and spec 087 call rooms with **no schema changes and exactly one new route** (host-initiated `/control/offer`); the Electron main reuses the existing agent WS handshake.
- Runs over the `yappchat` Postgres schema, Drizzle, Next.js 16 App Router; the desktop app joins the pnpm workspace.

## Notes

- This scope realizes the "later scope" anticipated by spec 088 Note (168) and spec 088 Deferred item — control running **in-app without a per-session download** — by scaffolding the desktop shell spec 008/087 anticipated, but only the **minimal** shell needed for injection.
- The consent/kill-switch/audit trust model is **entirely inherited** from spec 088; this scope adds no new trust surface, only new entry points (in-call) and a new injector (in-app).
- One-sharer-at-a-time and native-picker-only are deliberate v1 simplifications to keep this a wiring scope; a custom picker and multi-party share belong with the 087 conference path.

## Open Questions

- **Consent role in a call**: RESOLVED (2026-07-18) — the give-control button lives with the **sharer/host**; their click **is** the consent act (host-initiated), delivered by the new `/control/offer` route (FR-005a). Spec 088's controller-request → host-allow handshake is bypassed in-call; the peer is offered control and starts driving.
- **Desktop detection timing**: how early can the renderer read `window.yappchatDesktop` (preload timing) to choose the injection path before the grant. (Lean: available at load via contextBridge.)
- **Deployed URL for the shell**: which URL the Electron window loads by default (staging vs prod) and how dev points at `localhost:5175`. (Lean: env-configurable, default prod.)
- **Switch-screen UX**: whether "Switch" is a distinct button or re-clicking Share Screen re-opens the picker. (Lean: explicit Switch control while sharing.)

## Architecture Decisions (2026-07-18)

1. **Reuse the call's shared screen for control** — the controller drives the track already published on `dm-call-<id>`; no second share, no `rc-<sessionId>` room. Rejected: spinning up spec 088's separate stage (a second share / mode switch).
2. **Native picker only in v1** — `getDisplayMedia`/OS picker for select + switch; no custom thumbnail UI. Rejected: building an Electron `desktopCapturer` picker now (deferred).
3. **Environment-aware injection, one server path** — Electron main injects in-process; browser falls back to the spec 088 agent; **both** use the identical agent WS handshake and session/token/relay, so the server is unchanged. Rejected: an IPC-forwarded input path unique to Electron (more coupling, divergent server behavior).
4. **Shared `injection-core`** — extract nut.js + WS loop from `apps/agent` so the standalone agent and Electron main share one implementation. Rejected: duplicating injection logic in the desktop app.
5. **Minimal Electron shell** — load the deployed web UI; defer SQLite/auto-update/installers. Rejected: building the full `stack.md` client now (multi-week, unrelated to the control feature).
6. **Host-initiated offer via one new route** — the sharer's "Give Control" click is the consent act (the call is the trust context), delivered by `POST /control/offer` reusing spec 088's session/token service; the peer is offered control rather than requesting it. Rejected: (a) forcing the peer to "Request control" first (contradicts the user's sharer-side button); (b) a WS-only offer that auto-fires `request`+`allow` (convoluted, two round-trips). No new schema; all persistence, consent, tokens, and audit come from specs 087/088.

## Delta — Implemented 2026-07-18

Built end-to-end (web + shared agent core + minimal Electron shell). All automated checks green: **apps/web 144 tests + tsc clean** (14 new pure-logic tests), **apps/agent 3 tests**, **apps/desktop builds clean**. No schema/migration changes; exactly one new route. Two live two-machine gates (in-call browser control; desktop no-download control) remain **pending human verification**. LiveKit/WS/native-injection/Electron behavior is not exercised by unit tests (matches spec 088's manual-verification posture).

- **Screen share in call (FR-001..004)** — `DmCall.tsx`: Share Screen / Switch / Stop controls publish a `ScreenShare` track on the existing `dm-call-<id>` room (native picker, no download); pure `lib/call/tracks.ts` `classifyCallTrack` routes the shared screen to the main frame and demotes camera to a bottom-left PiP. Fixed in review: peer camera re-attaches to PiP/main across the share transition (was a blank-PiP/blank-main bug in the plan's handler design), and the native "Stop sharing" bar flips state via `LocalTrackUnpublished`.
- **Give / revoke control in call (FR-005..008)** — host-initiated: the sharer's **Give Control** click calls the new `POST /api/dm/:id/control/offer` (`offerControl` service — mirrors `requestControl`+`allowControl` with roles reversed, `agent_pending`, single-use token), the peer is offered control and drives the call's already-shared screen via the extracted `ControlInputSurface` (no second `rc-` room); **Revoke** flips back. Fail-closed teardown (FR-008) on: revoke, double-Esc panic (audited `panic:true`), app Stop-share, native Stop-sharing bar, and call-drop/unmount (keepalive stop). `roleOf` extracted and reused; consent/token/relay/audit reused unchanged from spec 088.
- **Environment-aware injection (FR-009..011)** — `lib/desktop/env.ts` detects `window.yappchatDesktop`; on desktop `giveControl` hands the token to the Electron main (in-process inject, **no download**); in a browser it falls back to the spec 088 agent download. Identical server session/token/relay for both.
- **Shared injection core (FR-013)** — `apps/agent/src/injection-core.mjs` (`createInjector({getScreen,onError})`) extracted from `agent.mjs`; the standalone agent and the Electron main both import it.
- **Minimal Electron shell (FR-012/014/015)** — `apps/desktop`: `main.ts` loads the deployed web UI (`YAPPCHAT_DESKTOP_URL` / dev `:5175`), `preload.ts` exposes the `yappchatDesktop` bridge, main opens the same `?controltoken=` agent WS handshake (no server change) and injects via `injection-core`. Loads ESM-from-CommonJS via a preserved dynamic `import()`. **uiohook parity added** (OS-global double-Esc panic + host-input auto-pause, listeners detached per session) so the desktop kill-switch works while unfocused. Deferred per FR-015: offline SQLite, auto-update, signed installers.
- **Reviews** — every task individually reviewed (spec + quality); a final whole-branch review (Opus) caught two integration issues since fixed: the offer route returned `id` not `sessionId` (undefined-session desync + lingering-token window), and the desktop injector lacked global panic/auto-pause. Open minor (accepted): `offerControl` audits `requested` with the host's id (no `offered` enum); `switchShare` guarded so a screen switch no longer tears down control.
