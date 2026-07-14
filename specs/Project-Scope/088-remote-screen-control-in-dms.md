# SCOPE-088: Remote Screen Control in DMs

**Scope Number**: 088
**Status**: `draft`
**Created**: 2026-07-13
**Last Reviewed**: 2026-07-13
**Depends On**: SPEC-018 (Contacts & DMs — the P2P entry point), SPEC-071 (Presentations — LiveKit screen-share media this reuses), SPEC-087 (Conferences — participant screen share / display-media path), SPEC-003 (WebSocket engine — realtime control channel), SPEC-011 (auth — session-token minting), SPEC-068 (storage/upload + app shell — signed agent binary download)
**Source**: `specs/Project-Scope/088-remote-screen-control-in-dms.md`

## Overview

Inside a **1:1 (P2P) direct message**, one person can **share their screen** and the other can **request and be granted live control of it** — mouse and keyboard — the way Microsoft Teams' "give control" works, scoped to a support/hand-off context. Screen **viewing** reuses the existing LiveKit screen-share media (specs 071/087) and needs **no download**. Actual **control** is delivered by an **ephemeral, single-use, token-authorized Windows helper agent** (TeamViewer QuickSupport-style): the person to be controlled downloads a tiny signed binary carrying a one-time token, runs it, explicitly allows control, and it injects input for that session only — no standing install, self-terminating when the session ends, killable instantly.

Control is **always consented, always visible, and always reclaimable**: the controlled user clicks *Allow* every session, sees a persistent "X is controlling your screen" banner, can end control instantly with a Stop button or a global panic hotkey, and their own mouse/keyboard input auto-pauses the remote controller. Every control session is audited server-side.

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | Controller — a signed-in YappChat user in a DM who requests control of the other person's shared screen (a helper / presenter). |
| **Secondary Actors** | Host (controlled user) — shares their screen, downloads/runs the helper agent, grants and can instantly revoke control; the DM conversation (spec 018) that scopes identity + trust; the realtime WebSocket engine (spec 003) carrying the control channel; LiveKit SFU (specs 071/087) carrying the screen video; the signed Windows helper agent that injects input. |
| **Key Value** | Give or get hands-on help without leaving YappChat or standing up TeamViewer/Teams — click to show a screen, click to hand over control, all bound to the DM you already trust, with a one-time agent that leaves nothing installed. |

## Business Problem

YappChat carries DMs, communities, chat, and (via 071/087) live screen share, but when one person needs to actually *do something on another person's machine* — a support agent fixing a setting, a presenter letting a teammate drive — there is no in-product way to hand over the mouse and keyboard. Today that means leaving for TeamViewer, AnyDesk, or a Teams call, installing software, exchanging IDs/PINs out of band, and losing the connection to the conversation and the relationship that already establishes trust. A browser tab fundamentally cannot inject input into another machine's operating system, so "take control" has never been possible from the web app alone. This is prioritized now because the hard media half — LiveKit screen share, the `videoroom` realtime scope, auth, and storage — already exists; the missing piece is a small, safe, ephemeral native input agent and the consent/session model around it.

## Actors

- Primary: Controller — signed-in user in a DM who requests and drives control of the other party's shared screen.
- Secondary: Host (controlled) — shares their full display, downloads and runs the one-time helper agent, grants control, and holds the kill switch.
- Secondary: DM conversation (spec 018) — the accepted 1:1 relationship that scopes who may request control of whom and seeds identity.
- Secondary: Realtime WebSocket engine (spec 003) — carries the `remotecontrol:{sessionId}` control channel (input events + session status).
- Secondary: LiveKit SFU (specs 071/087) — carries the host's screen video to the controller (view-only path; no download).
- Secondary: Windows helper agent — the ephemeral signed binary that authenticates with the session token, injects mouse/keyboard, and self-terminates on session end.

## Scope Boundary

**IN (v1):** P2P/DM only; host shares a **full display** via LiveKit; controller requests control; **ephemeral single-use tokenized Windows helper agent** (input-only) injects **mouse (move/click/scroll) + keyboard**; explicit per-session consent; persistent control banner; instant Stop button + **global panic hotkey**; local-input-wins auto-pause; server-side audit of every session; agent connects **outbound only** and self-terminates. New tables for control sessions + audit; new `/api/dm/.../control/*` routes; new `remotecontrol:{sessionId}` WS scope; a new signed Windows agent artifact (`apps/agent`).

**OUT (v1):** macOS / Linux agents; clipboard sync; file transfer; **unattended / persistent** remote access; standing desktop-app install; control in **group DMs, communities, or conference rooms**; multi-monitor picking beyond the single shared display; recording of a control session; the browser being able to control without the agent.

## Out of Scope

Building the full Electron desktop client (this ships a **single-purpose helper agent**, not the general desktop app); any control without an active, consenting host present; injecting input off the shared display surface; AI-driven or automated control.

## User Scenarios & Testing

### US1 — Support hand-off in a DM (happy path)

**Actor**: Controller (helper) + Host (being helped)

**Scenario**:
1. Both are in an accepted 1:1 DM. Host clicks **Share my screen** → picks a full display → the controller sees it live (LiveKit).
2. Controller clicks **Request control**. Host gets a prompt: **Download helper & allow control**.
3. Host downloads the tiny signed agent (token embedded), runs it; it connects outbound and registers against the session.
4. Host clicks **Allow control**. A persistent banner shows "**{Controller} is controlling your screen**".
5. Controller's clicks/keys drive the host machine; coordinates are normalized on the video and mapped to the display by the agent.
6. Host moves their own mouse → remote control **auto-pauses**; it resumes when they stop.
7. Either party clicks **Stop** (or host hits the panic hotkey) → control ends, token is spent, agent process exits, banner clears.

**Expected outcome**: No input is injected before the host clicks Allow; control is visible for its full duration; Stop/panic cuts control within ~1s and terminates the agent even if the browser is unresponsive; an audit row records controller, host, DM, start/end, duration.

### US2 — Present-with-handoff

**Actor**: Presenter (Host) + viewer (Controller)

**Scenario**: Host is sharing to demo something, briefly hands the mouse to the viewer to try a step, then reclaims by touching their own mouse (auto-pause) or clicking Stop.

**Expected outcome**: Control grant/pause/reclaim happen without ending the screen share; the viewer can only act while control is granted and not paused.

### US3 — Consent refused / revoked

**Actor**: Host

**Scenario**: Controller requests control; host **declines** the prompt (or grants, then hits Stop/panic mid-session, or closes the DM / loses connection).

**Expected outcome**: Decline → no agent download prompt persists and no control channel opens. Mid-session Stop/disconnect → control ends immediately, token invalidated, agent exits; no further input is accepted.

### US4 — Degraded / edge conditions

**Actor**: Host + Controller

**Scenario**: Agent fails to connect (firewall), token expired before the agent registered, LiveKit share dropped mid-control, host shares a single window instead of a full display, controller disconnects.

**Expected outcome**: Each failure degrades safely — control never activates without a registered agent + granted consent + live display share; an expired/spent token is rejected; losing the video or the controller ends control (fails closed), never leaving an orphaned agent with standing access.

## Functional Requirements

### Screen sharing (reused media)
- **FR-001** — In a P2P DM, either party may **share a full display** over the existing LiveKit path (specs 071/087); the other sees it live with no download. View-only is the default and always available.
- **FR-002** — Control requires an **active full-display share by the host**; sharing a single window/tab disables the control request (coordinates can't map to the OS reliably).

### Control request & consent
- **FR-003** — The controller may **Request control** of the host's shared display; the host receives an explicit prompt and must **Allow** (per session, every session) before any input is injected. Decline is a clean no-op.
- **FR-004** — On Allow, a **persistent banner** ("{Controller} is controlling your screen") is shown to the host for the entire control session.

### The helper agent
- **FR-005** — Control is delivered by a **single-purpose, signed Windows helper agent** the host downloads on demand; the agent is **input-only** (no screen capture — video is LiveKit).
- **FR-006** — The agent carries/enters a **single-use session token**, connects **outbound only** (no inbound port/firewall change), authenticates against the control session, and **self-terminates** when the session ends.
- **FR-007** — The agent injects **mouse (move, click, scroll) + keyboard** via native Win32 (`SendInput` / nut.js), mapping **normalized [0,1] coordinates** from the shared video to the real display.

### Control channel & session
- **FR-008** — Input events + session status flow over a dedicated **`remotecontrol:{sessionId}` WebSocket scope** (spec 003): controller → agent input, and `granted`/`paused`/`resumed`/`ended` status both ways.
- **FR-009** — A **control session** is a server record bound to `(dmConversationId, controllerUserId, hostUserId)` with a single-use token (short TTL to register, then session-bound), lifecycle states, and start/end timestamps.

### Safety & reclaim
- **FR-010** — **Instant kill**: a persistent **Stop control** button (either party) and a **global panic hotkey** immediately end control and terminate the agent, working even if the browser is unresponsive.
- **FR-011** — **Local input wins**: the host using their own mouse/keyboard **auto-pauses** remote control; it resumes when they stop.
- **FR-012** — Control **fails closed**: loss of the video share, the controller, the agent, or the WS channel ends the session and invalidates the token — never an orphaned agent with standing access.
- **FR-013** — **No unattended access**: a control session always requires a present, consenting host; there is no standing install and no reconnect that skips consent.

### Audit
- **FR-014** — Every control session writes a **server-side audit record** (controller, host, DM, start, end, duration, end-reason) visible to both parties and retained for review.

## Data Requirements

- **remotecontrolsessions** — `id`, `dmconversationid` (FK → conversations), `controlleruserid`, `hostuserid`, `status` (`requested|agent_pending|granted|paused|ended`), `tokenhash` (single-use), `tokenexpiresat`, `startedat`, `endedat`, `endreason`, `createdat`.
- **remotecontrolaudit** — append-only: `id`, `sessionid` (FK), `event` (`requested|allowed|declined|agent_registered|granted|paused|resumed|stopped|panic|disconnected`), `actoruserid`, `at`, `payload`.
- Reuses spec 018 `conversations`/`conversationmembers` (the DM + its two members) and spec 011 `users`.

## API Routes

- `POST /api/dm/:conversationId/control/request` — controller requests control; creates a session (`requested`), returns session id.
- `POST /api/dm/:conversationId/control/:sessionId/allow` — host grants; mints the single-use token; returns the **signed agent download URL** (token embedded) + token.
- `POST /api/dm/:conversationId/control/:sessionId/decline` — host declines; closes the session.
- `POST /api/dm/:conversationId/control/:sessionId/stop` — either party ends control (button/panic).
- `GET  /api/dm/:conversationId/control/:sessionId` — session status (polling fallback to the WS channel).
- `GET  /api/agent/download?token=…` — serves the signed Windows helper binary (spec 068 storage), token-gated.
- Agent registration/auth + input transport ride the **`remotecontrol:{sessionId}`** WS scope (spec 003), not REST.

## Frontend Components

- **DM control bar** (in the spec 018 DM view) — Share screen / Request control / Stop, and live "controlling / being controlled" state.
- **Consent prompt** — the host's Allow / Decline dialog with the download-helper step.
- **Control banner** — persistent "{Controller} is controlling your screen" while granted.
- **Coordinate overlay** — captures controller pointer/keyboard over the LiveKit video and emits normalized events.
- **Audit view** — per-DM list of past control sessions.

## Success Criteria

1. No input is ever injected before the host's explicit per-session Allow — verified server-side and at the agent. — *FR-003*
2. Stop button and panic hotkey end control and terminate the agent within ~1 second, even with an unresponsive browser. — *FR-010*
3. Host local input pauses remote control within ~200 ms and resumes cleanly. — *FR-011*
4. A spent or expired token is rejected; an ended session never accepts further input; no orphaned agent retains access. — *FR-006, FR-012*
5. Control is impossible without an active full-display LiveKit share by the host. — *FR-002*
6. Every session produces a complete audit trail (both parties, timestamps, end-reason). — *FR-014*
7. The agent requires **no inbound firewall change** and leaves **nothing installed** after the session. — *FR-006, FR-013*

## Key Entities

- **Control session** — the consented, time-bounded grant of input control from host to controller within one DM.
- **Helper agent** — the ephemeral single-use signed Windows binary that injects input for one session.
- **Session token** — the single-use, short-lived credential binding an agent instance to a control session.
- **Control channel** — the `remotecontrol:{sessionId}` realtime scope carrying input events + status.

## Constraints

- Browsers cannot inject OS input → native agent is mandatory for control; view-only remains browser-native.
- Windows-only agent in v1 (native injection via `SendInput`/nut.js); the binary must be **code-signed**.
- Agent connects **outbound** to YappChat only (no inbound listener) to avoid firewall/NAT changes.
- Coordinate mapping requires a **full-display** share; single-window shares are view-only.
- P2P/DM only — group, community, and conference control are out of scope for v1.
- Runs over the `yappchat` Postgres schema, Drizzle, Next.js 16 App Router; migrations generated only (manual apply).

## Notes

- This scope deliberately ships a **single-purpose helper agent**, not the full Electron desktop client that specs 087/008 anticipate; if/when that desktop app exists, control can also run in-app without a per-session download, but that is a later scope.
- The DM relationship (spec 018, accept-to-connect) is the trust anchor — control can only be requested between two users who are already connected in a 1:1.

## Open Questions

- **Agent distribution**: ship the token **embedded** in a per-download binary, or a generic binary + a short **pairing code** the host types? (Lean: embedded token in the download for lowest friction; code entry as fallback.)
- **Panic hotkey**: fixed combo (e.g. double-Esc) vs. configurable; must be registered by the agent as a global hook.
- **Antivirus/SmartScreen**: a signed input-injecting binary may trip AV/SmartScreen — code-signing + reputation needed; acceptable for v1 pilot?
- **Multi-monitor**: v1 controls only the single shared display; how to surface which display is shared.

## Architecture Decisions (2026-07-13)

1. **Input-only agent, LiveKit for video** — reuse the 071/087 screen-share media; the downloaded agent does injection only (smallest binary, one media path). Rejected: a full agent that also captures the screen (bigger, second media stack).
2. **Ephemeral tokenized helper, not a standing install** — TeamViewer QuickSupport model: download-run-consent-discard; no unattended access. Rejected: requiring the full desktop app on both sides.
3. **P2P/DM only for v1** — the DM is the trust boundary; group/community/conference control deferred.
4. **Windows-only v1** — fastest, most-tested surface; macOS/Linux later.
5. **Fail-closed everywhere** — loss of consent, video, controller, agent, or channel ends control and invalidates the token.

## Delta — Implemented 2026-07-13

Built end-to-end (web + native agent); tsc + eslint clean, 132 tests pass (10 new state-machine tests). **Migration 0027 generated, not yet applied** (manual). LiveKit + native-agent behavior verified by the user on two machines.

- **Schema/migration** — `remotecontrolsessions` + `remotecontrolaudit` (`lib/db/remotecontrol-schema.ts`); hand-authored `drizzle/0027_remote_screen_control.sql` (drizzle journal desynced past 0019 → `generate` over-diffs).
- **Service + state machine** — `lib/remotecontrol/service.ts` (requested→agent_pending→granted↔paused→ended, single-use token hash, consent-before-token, fail-closed) + pure `state.ts` with `state.test.ts` (consent can't be skipped, `end` from any active state).
- **API** — `/api/dm/:id/control/{request,allow,decline,stop,sessions}` + `/:sessionId` status + `/:sessionId/livekit` (mints a `rc-<sessionId>` LiveKit token; host publishes, controller subscribes) + `/api/agent/download` (token-stamped `.cmd` launcher).
- **WS engine** (`server/ws.ts`) — `remotecontrol:{sessionId}` scope authz (participant-checked); **agent connections** via `?controltoken` → `registerAgent` (grants + consumes token), force-subscribed to the session scope; a non-persisted **input relay** (`control_input`) controller→agent; `control_pause`/`control_resume` (host or agent); **agent disconnect ends the session** (fail-closed). New `ClientMessage`/`ServerMessage`/`ControlInput` types + `scopes.remotecontrol` + `RemoteControlUpdated` event.
- **UI** — `RemoteControlPanel` (control bar, consent prompt, banner, panic hotkey, mounted in the DM header for `person` DMs), `RemoteControlStage` (full-screen LiveKit view + normalized pointer/keyboard capture → WS), `RemoteControlHistory` (FR-014 audit popover).
- **Native agent** — `apps/agent` (`agent.mjs`): outbound WS, nut.js injection (normalized→display), optional `uiohook-napi` for global panic hotkey + local-input auto-pause, self-terminates on `ended`/close. `README.md` has install + two-machine test + signing/packaging notes.
- **Deferred (productionization):** code-signed `.exe` (download currently serves a `.cmd` launcher for a globally-installed agent); controller-disconnect ending control (agent-disconnect already fails closed; host retains Stop/panic).

## Clarifications

### Session 2026-07-13

- **Q**: Primary use case? → **A**: Remote support **and** present-with-handoff (both asymmetric: a controller drives a consenting host).
- **Q**: How is OS control delivered given the browser can't inject and the desktop app isn't built? → **A**: **Download a small app with a token that allows control for the short term** (ephemeral tokenized helper agent).
- **Q**: Does the agent capture the screen too, or input only? → **A**: **Input-only**; screen stays on LiveKit.
- **Q**: Agent platform for v1? → **A**: **Windows only.**
- **Q**: Required safety guarantees? → **A**: **All four** — explicit per-session consent, instant kill switch + panic hotkey, local-input-wins auto-pause, always-visible banner + audit.
