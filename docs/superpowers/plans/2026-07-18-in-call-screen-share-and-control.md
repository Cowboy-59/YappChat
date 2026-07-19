# In-Call Screen Share & Give-Control + Desktop Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a participant in a 1:1 DM call share a screen (select / switch / cancel, no download) and give/revoke the peer control of it — reusing spec 088's consent/token/WS-relay/audit against the call's own shared screen — with a minimal Electron desktop shell that injects input in-process (browser falls back to the spec 088 agent download).

**Architecture:** Three phases. **A —** add a `ScreenShare` track + controls to the existing `DmCall` LiveKit overlay (`dm-call-<id>` room). **B —** extract spec 088's session lifecycle and input-capture surface into reusable units, add a host-initiated `POST /control/offer` route, and wire Give/Revoke Control + the input surface into `DmCall` over the call's shared-screen video. **C —** extract the agent's nut.js injection into a shared `injection-core` module, scaffold a minimal Electron shell (`apps/desktop`) that loads the deployed web UI and injects in-process, and make the renderer choose injection path by environment.

**Tech Stack:** Next.js 16 (App Router) + React 19, `livekit-client` ^2.20, `@yappchat/web` WS client (spec 003), Drizzle/Postgres (`yappchat` schema), Vitest ^4.1, `@nut-tree-fork/nut-js` (agent), Electron (new, `apps/desktop`), pnpm workspace.

## Global Constraints

- **Spec:** `specs/Project-Scope/089-in-call-screen-share-and-control.md` (SCOPE-089). Read it before starting.
- **No new tables or migrations.** Reuse spec 088 `remotecontrolsessions`/`remotecontrolaudit`, spec 087 call rooms.
- **Exactly one new server route:** `POST /api/dm/:conversationId/control/offer` (host-initiated). All other control routes reused unchanged.
- **Windows-only native injection** (nut.js), inherited from spec 088. Screen share/view is browser-native (LiveKit).
- **Native OS picker only** for screen selection (`setScreenShareEnabled(true)`); no custom thumbnail picker in v1.
- **Electron shell is minimal:** loads the deployed web URL (dev → `http://localhost:5175`); **no** offline SQLite, auto-update, or signed installer this scope.
- **Testing posture (match the codebase):** unit-test **pure logic** with Vitest (like `remotecontrol/state.test.ts`); LiveKit media, React overlays, native injection, and Electron are **manually verified** with the concrete steps given per task. Do not add React-Testing-Library or Electron e2e harnesses — none exist.
- **Commands** run from `apps/web` unless stated: tests `pnpm exec vitest run <file>`; lint `pnpm lint`; typecheck `pnpm exec tsc --noEmit`. Agent tests run from `apps/agent`.
- **`apps/web/AGENTS.md`:** "This is NOT the Next.js you know" — for any App-Router route work (Task 8) consult `node_modules/next/dist/docs/` before writing the handler; mirror the existing `control/[sessionId]/allow/route.ts` exactly.
- Frequent commits: one per task minimum. Work on branch `089-in-call-screen-share-and-control` (already created).

---

## Phase A — Screen share in a call

### Task 1: Call-track classification helper (pure)

A tiny pure module the render logic uses to decide which incoming/published track is the "main" (screen share, when present) vs. the "PiP" (camera). Keeps LiveKit-source branching out of the component and testable.

**Files:**
- Create: `apps/web/src/lib/call/tracks.ts`
- Test: `apps/web/src/lib/call/tracks.test.ts`

**Interfaces:**
- Produces:
  - `type CallTrackKind = "screen" | "camera" | "audio" | "other"`
  - `classifyCallTrack(source: string, kind: string): CallTrackKind` — `source`/`kind` are `Track.Source`/`Track.Kind` string values.
  - `pickMainKind(hasScreen: boolean): "screen" | "camera"` — screen wins when present.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/call/tracks.test.ts
import { describe, expect, it } from "vitest";
import { classifyCallTrack, pickMainKind } from "./tracks";

describe("classifyCallTrack", () => {
  it("maps screen-share video to 'screen'", () => {
    expect(classifyCallTrack("screen_share", "video")).toBe("screen");
  });
  it("maps camera video to 'camera'", () => {
    expect(classifyCallTrack("camera", "video")).toBe("camera");
  });
  it("maps any audio to 'audio'", () => {
    expect(classifyCallTrack("microphone", "audio")).toBe("audio");
    expect(classifyCallTrack("screen_share_audio", "audio")).toBe("audio");
  });
  it("falls back to 'other' for unknown video sources", () => {
    expect(classifyCallTrack("unknown", "video")).toBe("other");
  });
});

describe("pickMainKind", () => {
  it("prefers screen when a screen share exists", () => {
    expect(pickMainKind(true)).toBe("screen");
  });
  it("defaults to camera otherwise", () => {
    expect(pickMainKind(false)).toBe("camera");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/call/tracks.test.ts`
Expected: FAIL — "Cannot find module './tracks'".

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/call/tracks.ts
/**
 * Spec 089 — pure classification for call tracks so DmCall can route the shared
 * screen to the main frame and the camera to the PiP. `source`/`kind` are the
 * string values of livekit-client `Track.Source` / `Track.Kind`.
 */
export type CallTrackKind = "screen" | "camera" | "audio" | "other";

export function classifyCallTrack(source: string, kind: string): CallTrackKind {
  if (kind === "audio") return "audio";
  if (source === "screen_share") return "screen";
  if (source === "camera") return "camera";
  return "other";
}

/** Screen share (when present) owns the main frame; camera is the fallback. */
export function pickMainKind(hasScreen: boolean): "screen" | "camera" {
  return hasScreen ? "screen" : "camera";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/call/tracks.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/call/tracks.ts apps/web/src/lib/call/tracks.test.ts
git commit -m "feat(089): pure call-track classification helper"
```

---

### Task 2: Share Screen / Switch / Stop in DmCall (publish side)

Add screen-share state and the three controls to `DmCall`'s control bar. Publishing uses LiveKit `setScreenShareEnabled`, which opens the native picker (= "select a screen"). Switch = stop then re-enable (re-opens picker). Cancel/stop = disable. Picker-cancel rejects the promise → treated as a no-op.

**Files:**
- Modify: `apps/web/src/components/chats/DmCall.tsx`

**Interfaces:**
- Consumes: `classifyCallTrack` is not needed here (publish side); used in Task 3.
- Produces: local component behavior only.

- [ ] **Step 1: Add screen-share state and toggle handlers**

In `DmCall.tsx`, after the `camOff` state (line 29) add:

```tsx
  const [sharing, setSharing] = useState(false);
  const screenSelfRef = useRef<HTMLVideoElement | null>(null);
```

After `toggleCam` (ends line 93) add:

```tsx
  const startShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(true);
      setSharing(true);
      const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track && screenSelfRef.current) pub.track.attach(screenSelfRef.current);
    } catch {
      /* user cancelled the OS picker — no-op */
      setSharing(false);
    }
  }, []);

  const stopShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    setSharing(false);
    await room.localParticipant.setScreenShareEnabled(false).catch(() => {});
  }, []);

  const switchShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false).catch(() => {});
    await startShare();
  }, [startShare]);
```

- [ ] **Step 2: Add the buttons to the control bar**

In the control-bar `<div className="flex items-center justify-center gap-4 py-4">` (line 125), insert **before** the hang-up button (line 142):

```tsx
        {!sharing ? (
          <button
            type="button"
            onClick={startShare}
            title="Share your screen"
            className={`${ctrl} bg-white text-neutral-900`}
          >
            🖥️
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={switchShare}
              title="Switch shared screen"
              className={`${ctrl} bg-white/20 text-white`}
            >
              🔀
            </button>
            <button
              type="button"
              onClick={stopShare}
              title="Stop sharing"
              className={`${ctrl} bg-white/20 text-white`}
            >
              🛑
            </button>
          </>
        )}
```

- [ ] **Step 3: Typecheck & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Manual verification (two browsers, LiveKit configured)**

Start the web app + WS engine (`pnpm dev` and `pnpm ws` in `apps/web`) with LiveKit env set. From two signed-in users in an accepted DM, start a call (📞). On caller: click 🖥️ → native picker opens → pick a screen. Confirm: the 🖥️ button becomes 🔀 + 🛑; clicking 🔀 re-opens the picker; clicking 🛑 stops sharing; cancelling the picker leaves you un-shared with no error toast. (Remote rendering is Task 3.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chats/DmCall.tsx
git commit -m "feat(089): Share Screen / Switch / Stop controls in DmCall (publish)"
```

---

### Task 3: Render the shared screen full-frame, camera to PiP (subscribe side)

Update `DmCall`'s track handling so a subscribed `ScreenShare` renders in the main frame and the camera drops to the PiP; reverting when the share ends. Uses `classifyCallTrack` from Task 1.

**Files:**
- Modify: `apps/web/src/components/chats/DmCall.tsx`

**Interfaces:**
- Consumes: `classifyCallTrack` from `@/lib/call/tracks`.

- [ ] **Step 1: Import the helper and add a "peer is sharing" state**

At the top imports add:

```tsx
import { classifyCallTrack } from "@/lib/call/tracks";
```

Add state near `sharing` (Task 2):

```tsx
  const [peerSharing, setPeerSharing] = useState(false);
  const remoteCamRef = useRef<HTMLVideoElement | null>(null);
```

- [ ] **Step 2: Replace the TrackSubscribed handler and add TrackUnsubscribed**

Replace the existing `RoomEvent.TrackSubscribed` handler (lines 43–46) with:

```tsx
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        const kind = classifyCallTrack(String(track.source), String(track.kind));
        if (kind === "audio") return void track.attach();
        if (kind === "screen") {
          if (remoteRef.current) track.attach(remoteRef.current); // screen → main frame
          setPeerSharing(true);
        } else if (kind === "camera") {
          // Peer camera: PiP if a screen is main, else main frame.
          const el = peerSharing ? remoteCamRef.current : remoteRef.current;
          if (el) track.attach(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (classifyCallTrack(String(track.source), String(track.kind)) === "screen") {
          track.detach();
          setPeerSharing(false);
        }
      });
```

Add `RoomEvent` and `RemoteTrack` are already imported (line 4).

- [ ] **Step 3: Add the peer-camera PiP element to the render**

In the `<div className="relative flex-1">` block, after the remote `<video ref={remoteRef} …/>` (line 107), add a second remote PiP shown only while the peer shares a screen:

```tsx
        {peerSharing && (
          <video
            ref={remoteCamRef}
            className="absolute bottom-4 left-4 h-32 w-44 rounded-xl border border-white/20 bg-black object-cover shadow-lg"
            autoPlay
            playsInline
          />
        )}
```

(The existing local self-view PiP stays bottom-right; the peer camera PiP sits bottom-left so both are visible during a share.)

- [ ] **Step 4: Typecheck & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Repeat Task 2's two-browser call. When user A shares a screen, confirm user B sees the **screen full-frame** and A's **camera in the bottom-left PiP**; when A stops sharing, B reverts to A's camera full-frame. Swap roles to confirm both directions.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chats/DmCall.tsx
git commit -m "feat(089): render shared screen full-frame, camera to PiP in DmCall"
```

---

## Phase B — Give / Revoke control inside the call

### Task 4: Extract `roleOf` (pure) and reuse it in RemoteControlPanel

`RemoteControlPanel` computes "am I controller or host" inline (lines 67–71). Extract it so `DmCall` reuses the exact same rule.

**Files:**
- Create: `apps/web/src/lib/remotecontrol/role.ts`
- Test: `apps/web/src/lib/remotecontrol/role.test.ts`
- Modify: `apps/web/src/components/chats/RemoteControlPanel.tsx`

**Interfaces:**
- Produces: `roleOf(session: { controlleruserid: string; hostuserid: string } | null, currentUserId: string): "controller" | "host" | null`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/remotecontrol/role.test.ts
import { describe, expect, it } from "vitest";
import { roleOf } from "./role";

describe("roleOf", () => {
  const s = { controlleruserid: "c1", hostuserid: "h1" };
  it("returns controller for the controller user", () => {
    expect(roleOf(s, "c1")).toBe("controller");
  });
  it("returns host for the host user", () => {
    expect(roleOf(s, "h1")).toBe("host");
  });
  it("returns null when there is no session", () => {
    expect(roleOf(null, "c1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/remotecontrol/role.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/remotecontrol/role.ts
/** Spec 088/089 — which side of a control session `currentUserId` is on. */
export function roleOf(
  session: { controlleruserid: string; hostuserid: string } | null,
  currentUserId: string,
): "controller" | "host" | null {
  if (!session) return null;
  return session.controlleruserid === currentUserId ? "controller" : "host";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/remotecontrol/role.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in RemoteControlPanel (no behavior change)**

In `RemoteControlPanel.tsx`, add the import:

```tsx
import { roleOf } from "@/lib/remotecontrol/role";
```

Replace the inline role block (lines 67–71):

```tsx
  const role: "controller" | "host" | null = session
    ? session.controlleruserid === currentUserId
      ? "controller"
      : "host"
    : null;
```

with:

```tsx
  const role = roleOf(session, currentUserId);
```

- [ ] **Step 6: Typecheck, lint, and run the control tests**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm exec vitest run src/lib/remotecontrol`
Expected: PASS; no new type/lint errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/remotecontrol/role.ts apps/web/src/lib/remotecontrol/role.test.ts apps/web/src/components/chats/RemoteControlPanel.tsx
git commit -m "refactor(089): extract roleOf helper, reuse in RemoteControlPanel"
```

---

### Task 5: `offerControl` service function (host-initiated) + test

Add the host-initiated offer to the control service: mirrors `requestControl` (supersede + create) + `allowControl` (mint token) with roles reversed and status jumping straight to `agent_pending`.

**Files:**
- Modify: `apps/web/src/lib/remotecontrol/service.ts`
- Test: `apps/web/src/lib/remotecontrol/offer.test.ts` (pure argument/shape guard — DB is mocked minimally; see step 1)

**Interfaces:**
- Produces: `offerControl(dmconversationid: string, hostuserid: string): Promise<{ session: RemoteControlSessionRow; token: string }>`.

- [ ] **Step 1: Write a focused unit test for role assignment**

The service talks to Postgres, so full integration is manual (step 5). Unit-test the one piece of new *logic* — that `offerControl` assigns the caller as host and the peer as controller — by mocking `resolveDmPeer` via the db layer is heavy; instead assert the exported function exists and is wired. Write a light contract test:

```ts
// apps/web/src/lib/remotecontrol/offer.test.ts
import { describe, expect, it } from "vitest";
import * as service from "./service";

describe("offerControl", () => {
  it("is exported as an async function taking (dmId, hostUserId)", () => {
    expect(typeof service.offerControl).toBe("function");
    expect(service.offerControl.length).toBe(2);
  });
});
```

(Behavioral correctness — host/controller assignment, token mint, `agent_pending` — is verified end-to-end in step 5, matching how spec 088's routes were verified.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/remotecontrol/offer.test.ts`
Expected: FAIL — `service.offerControl` is undefined.

- [ ] **Step 3: Implement `offerControl`**

In `service.ts`, after `requestControl` (ends line 107) add:

```ts
/**
 * Spec 089 FR-005a — host-initiated give-control from inside a call. The SHARER
 * (host) offers control to the peer; the click IS the consent, so the session is
 * created already-consented at `agent_pending` with the single-use token minted.
 * Mirrors requestControl (supersede + create) + allowControl (token) with the
 * roles reversed. Returns the session + raw token for the agent/desktop injector.
 */
export async function offerControl(
  dmconversationid: string,
  hostuserid: string,
): Promise<{ session: RemoteControlSessionRow; token: string }> {
  const controlleruserid = await resolveDmPeer(dmconversationid, hostuserid);

  // Supersede any lingering active session for this DM (fail-closed hygiene).
  const stale = await db()
    .select({ id: remotecontrolsessions.id })
    .from(remotecontrolsessions)
    .where(
      and(
        eq(remotecontrolsessions.dmconversationid, dmconversationid),
        inArray(remotecontrolsessions.status, ACTIVE_STATUSES),
      ),
    );
  for (const s of stale) await endControl(s.id, hostuserid, "disconnected").catch(() => {});

  const token = generateToken();
  const [row] = await db()
    .insert(remotecontrolsessions)
    .values({
      id: uuidv7(),
      dmconversationid,
      controlleruserid,
      hostuserid,
      status: "agent_pending",
      tokenhash: hashToken(token),
      tokenexpiresat: new Date(Date.now() + TOKEN_TTL_MS),
    })
    .returning();
  await audit(row.id, "requested", hostuserid);
  await audit(row.id, "allowed", hostuserid);
  void publishControlStatus(row);
  return { session: row, token };
}
```

- [ ] **Step 4: Run test to verify it passes + typecheck**

Run: `pnpm exec vitest run src/lib/remotecontrol/offer.test.ts && pnpm exec tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit** (end-to-end verification happens after the route + UI land, Task 10)

```bash
git add apps/web/src/lib/remotecontrol/service.ts apps/web/src/lib/remotecontrol/offer.test.ts
git commit -m "feat(089): offerControl service (host-initiated give-control)"
```

---

### Task 6: `POST /control/offer` route

Add the one new route, mirroring the existing `allow` route's auth + response shape but calling `offerControl`.

**Files:**
- Create: `apps/web/src/app/api/dm/[conversationId]/control/offer/route.ts`
- Reference (read, mirror exactly): `apps/web/src/app/api/dm/[conversationId]/control/[sessionId]/allow/route.ts`

**Interfaces:**
- Consumes: `offerControl` (Task 5).
- Produces: `POST` returning `{ session, token, downloadUrl }` (same shape as `allow`).

- [ ] **Step 1: Read the reference route**

Open `apps/web/src/app/api/dm/[conversationId]/control/[sessionId]/allow/route.ts` and note exactly: how it reads the session user (auth helper), how it builds `downloadUrl` from the token, the params typing for App-Router (this is Next 16 — heed `AGENTS.md`), and its error handling. The offer route must match all of these.

- [ ] **Step 2: Write the route (mirror `allow`, swap the service call)**

Create `apps/web/src/app/api/dm/[conversationId]/control/offer/route.ts` with the **same** imports, auth-user resolution, `downloadUrl` construction, and error handling as `allow/route.ts`, changing only:
- the handler reads `conversationId` from params (no `sessionId`);
- it calls `const { session, token } = await offerControl(conversationId, <currentUserId>);`
- it returns `Response.json({ session, token, downloadUrl })` using the identical `downloadUrl` builder from the allow route.

Do not invent auth or URL-building code — copy the mechanisms verbatim from `allow/route.ts` so the two stay consistent.

- [ ] **Step 3: Typecheck & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Smoke-test the route shape** (dev server running)

With `pnpm dev` up and signed in as a DM member, from the browser devtools console on the app origin:

```js
await (await fetch(`/api/dm/${CONV_ID}/control/offer`, { method: "POST", credentials: "include" })).json()
```

Expected: `{ session: { status: "agent_pending", hostuserid: <me>, controlleruserid: <peer>, ... }, token: "…", downloadUrl: "…" }`. (Replace `CONV_ID` with an accepted person-DM id.) Then clean up: `await fetch(\`/api/dm/${CONV_ID}/control/${SESSION_ID}/stop\`, {method:"POST",credentials:"include"})`.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/dm/[conversationId]/control/offer/route.ts"
git commit -m "feat(089): POST /control/offer route (host-initiated give-control)"
```

---

### Task 7: Extract `ControlInputSurface` from RemoteControlStage

Lift the controller's pointer/keyboard capture overlay (RemoteControlStage lines 96–158) into a standalone component so `DmCall` can mount it over the call's shared-screen video without RemoteControlStage's own LiveKit room. RemoteControlStage is refactored to use it (no behavior change).

**Files:**
- Create: `apps/web/src/components/chats/ControlInputSurface.tsx`
- Modify: `apps/web/src/components/chats/RemoteControlStage.tsx`

**Interfaces:**
- Produces: `ControlInputSurface({ sessionId, active }: { sessionId: string; active: boolean }): JSX.Element | null` — renders an absolutely-positioned capture layer over its positioned parent; emits normalized `control_input` via `useWSClient().sendControlInput`. Renders `null` when `!active`.

- [ ] **Step 1: Create the component (move the logic verbatim)**

```tsx
// apps/web/src/components/chats/ControlInputSurface.tsx
"use client";

import { useCallback, useRef } from "react";
import { useWSClient } from "@/components/ws/WSProvider";
import type { ControlInput } from "@/lib/ws/events";

/**
 * Spec 088/089 — the controller's pointer/keyboard capture layer. Absolutely
 * fills its positioned parent (the shared-screen video), normalizes coordinates
 * to [0,1] over itself, and relays input over the WS control scope. Reused by
 * RemoteControlStage (separate-room control) and DmCall (in-call control).
 */
const MOVE_THROTTLE_MS = 16; // ~60 fps for pointer moves

function normButton(b: number): "left" | "right" | "middle" {
  return b === 2 ? "right" : b === 1 ? "middle" : "left";
}

export function ControlInputSurface({ sessionId, active }: { sessionId: string; active: boolean }) {
  const ws = useWSClient();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const lastMove = useRef(0);

  const send = useCallback((input: ControlInput) => ws.sendControlInput(sessionId, input), [ws, sessionId]);

  const norm = (clientX: number, clientY: number) => {
    const el = surfaceRef.current;
    if (!el) return { x: 0, y: 0 };
    const b = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (clientY - b.top) / b.height)),
    };
  };

  if (!active) return null;

  return (
    <div
      ref={surfaceRef}
      className="absolute inset-0 cursor-crosshair outline-none"
      tabIndex={0}
      onPointerMove={(e) => {
        const now = e.timeStamp;
        if (now - lastMove.current < MOVE_THROTTLE_MS) return;
        lastMove.current = now;
        const p = norm(e.clientX, e.clientY);
        send({ t: "move", x: p.x, y: p.y });
      }}
      onPointerDown={(e) => {
        e.currentTarget.focus();
        const p = norm(e.clientX, e.clientY);
        send({ t: "down", x: p.x, y: p.y, button: normButton(e.button) });
      }}
      onPointerUp={(e) => {
        const p = norm(e.clientX, e.clientY);
        send({ t: "up", x: p.x, y: p.y, button: normButton(e.button) });
      }}
      onWheel={(e) => {
        const p = norm(e.clientX, e.clientY);
        send({ t: "scroll", x: p.x, y: p.y, dx: e.deltaX, dy: e.deltaY });
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        e.preventDefault();
        send({ t: "key", key: e.key, down: true });
      }}
      onKeyUp={(e) => {
        e.preventDefault();
        send({ t: "key", key: e.key, down: false });
      }}
    />
  );
}
```

- [ ] **Step 2: Refactor RemoteControlStage to use it**

In `RemoteControlStage.tsx`: remove the now-duplicated `MOVE_THROTTLE_MS`, `normButton`, `send`, `norm`, and `lastMove` (lines 16–20, 40, 96–106), and the `useWSClient`/`ControlInput` imports if unused. Replace the inline `controllerActive && (<div ref={surfaceRef} …/>)` block (lines 124–159) with:

```tsx
        <ControlInputSurface sessionId={sessionId} active={role === "controller" && !paused} />
```

Add the import:

```tsx
import { ControlInputSurface } from "@/components/chats/ControlInputSurface";
```

Keep `videoRef`, the LiveKit room effect, and the host share/self-preview exactly as-is.

- [ ] **Step 3: Typecheck & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors (watch for now-unused imports in RemoteControlStage — remove them).

- [ ] **Step 4: Manual verification (regression — DM-header control still works)**

Using the existing DM-header "🖥️ Request control" flow (RemoteControlPanel), confirm a full control session still works end-to-end between two machines exactly as before this refactor: request → allow → agent → drive → stop. No behavior should differ.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chats/ControlInputSurface.tsx apps/web/src/components/chats/RemoteControlStage.tsx
git commit -m "refactor(089): extract ControlInputSurface, reuse in RemoteControlStage"
```

---

### Task 8: Thread `currentUserId` to DmCall

`DmCall` needs the current user id to compute control role. It is mounted by `DmCallManager` (app-wide via `AppRealtime`), which doesn't currently receive it. Thread it down.

**Files:**
- Modify: `apps/web/src/components/ws/DmCallManager.tsx`
- Modify: `apps/web/src/components/chats/DmCall.tsx`
- Modify: the component that renders `<AppRealtime />` (find it — see step 1)

**Interfaces:**
- Produces: `DmCallManager({ currentUserId }: { currentUserId: string })`; `DmCall` gains a `currentUserId: string` prop.

- [ ] **Step 1: Locate the AppRealtime mount and its user source**

Run: `grep -rn "AppRealtime" apps/web/src` and `grep -rn "DmCallManager" apps/web/src`. Identify where `<AppRealtime />` is rendered and what session/user value is in scope there (the same value `ChatsApp` receives as `currentUserId` — e.g. from the authenticated layout/session). You will pass that down.

- [ ] **Step 2: Add the prop through the chain**

- `DmCall.tsx`: add `currentUserId: string` to the props type (near `conversationId`, line 18) and destructure it.
- `DmCallManager.tsx`: change the signature to `export function DmCallManager({ currentUserId }: { currentUserId: string })` and pass it to `<DmCall … currentUserId={currentUserId} />` (line 146).
- `AppRealtime.tsx`: accept `currentUserId` and pass it to `<DmCallManager currentUserId={currentUserId} />` (line 34); add it to AppRealtime's props.
- The AppRealtime mount site (from step 1): pass the in-scope user id, e.g. `<AppRealtime currentUserId={session.userId} />` (use the actual variable there).

- [ ] **Step 3: Typecheck & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors (a missing prop anywhere in the chain surfaces here).

- [ ] **Step 4: Manual smoke**

Reload the app; start a call. Nothing should change visually. Add a temporary `console.log(currentUserId)` in `DmCall` to confirm a real id arrives, then remove it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ws/DmCallManager.tsx apps/web/src/components/chats/DmCall.tsx apps/web/src/components/ws/AppRealtime.tsx
# plus the AppRealtime mount-site file from step 1
git commit -m "feat(089): thread currentUserId to DmCall for control role"
```

---

### Task 9: Give / Revoke Control + input surface in DmCall (browser path)

Wire the in-call control: while **I** am sharing, show **Give Control**; when a session is live and I'm host, show **Revoke Control** + the spec 088 download/banner; when I'm the controller, overlay `ControlInputSurface` on the shared-screen video. This uses the offer route and reacts to `remotecontrol.updated` WS events.

**Files:**
- Modify: `apps/web/src/components/chats/DmCall.tsx`

**Interfaces:**
- Consumes: `roleOf` (`@/lib/remotecontrol/role`), `ControlInputSurface`, `useWSEvent` (`@/components/ws/WSProvider`), `WSEventType`/`WSEvent` (`@/lib/ws/events`).

- [ ] **Step 1: Add control session state + WS subscription**

Add imports:

```tsx
import { useWSEvent } from "@/components/ws/WSProvider";
import { WSEventType, type WSEvent } from "@/lib/ws/events";
import { roleOf } from "@/lib/remotecontrol/role";
import { ControlInputSurface } from "@/components/chats/ControlInputSurface";
```

Add state near `sharing`:

```tsx
  type CtrlSession = { sessionId: string; status: string; dmconversationid: string; controlleruserid: string; hostuserid: string };
  const [ctrl089, setCtrl089] = useState<CtrlSession | null>(null);
  const [ctrlDownloadUrl, setCtrlDownloadUrl] = useState<string | null>(null);

  const onCtrlUpdate = useCallback(
    (e: WSEvent) => {
      const p = e.payload as CtrlSession;
      if (!p || p.dmconversationid !== conversationId) return;
      if (p.status === "ended") {
        setCtrl089(null);
        setCtrlDownloadUrl(null);
      } else {
        setCtrl089(p);
      }
    },
    [conversationId],
  );
  useWSEvent(WSEventType.RemoteControlUpdated, onCtrlUpdate);

  const ctrlRole = roleOf(ctrl089, currentUserId);
```

(Named `ctrl089` to avoid colliding with the existing `ctrl` button-class string on line 96.)

- [ ] **Step 2: Add give / revoke handlers**

```tsx
  const giveControl = useCallback(async () => {
    const r = await fetch(`/api/dm/${conversationId}/control/offer`, { method: "POST", credentials: "include" });
    if (!r.ok) return;
    const data = (await r.json()) as { session: CtrlSession; downloadUrl: string };
    setCtrl089(data.session);
    setCtrlDownloadUrl(data.downloadUrl); // browser path: host runs the agent (Task 12 skips this on desktop)
  }, [conversationId]);

  const revokeControl = useCallback(async () => {
    if (!ctrl089) return;
    await fetch(`/api/dm/${conversationId}/control/${ctrl089.sessionId}/stop`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panic: false }),
    }).catch(() => {});
    setCtrl089(null);
    setCtrlDownloadUrl(null);
  }, [conversationId, ctrl089]);
```

- [ ] **Step 3: Add the Give/Revoke button (only while I'm sharing) to the control bar**

Inside the `sharing` branch from Task 2 (next to 🔀 / 🛑), add:

```tsx
            {!ctrl089 ? (
              <button type="button" onClick={giveControl} title="Give control of your screen" className={`${ctrl} bg-white text-neutral-900`}>
                🕹️
              </button>
            ) : ctrlRole === "host" ? (
              <button type="button" onClick={revokeControl} title="Revoke control" className={`${ctrl} bg-red-600 text-white`}>
                ⛔
              </button>
            ) : null}
```

- [ ] **Step 4: Show the host download prompt (browser path) + a controlling banner**

Below the control bar `<div>` (before the closing overlay `</div>`, ~line 145), add:

```tsx
      {ctrlRole === "host" && ctrlDownloadUrl && ctrl089?.status === "agent_pending" && (
        <div className="flex items-center justify-center gap-2 pb-3 text-xs text-white">
          <span>Run the helper to grant control:</span>
          <a className="rounded-lg bg-white px-2.5 py-1 font-semibold text-neutral-900" href={ctrlDownloadUrl} target="_blank" rel="noopener noreferrer">
            Download helper
          </a>
        </div>
      )}
      {ctrlRole === "host" && (ctrl089?.status === "granted" || ctrl089?.status === "paused") && (
        <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 rounded-lg bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
          🔴 {peerName} is controlling your screen — press Esc twice or ⛔ to stop
        </div>
      )}
```

- [ ] **Step 5: Overlay the input surface for the controller over the shared screen**

In the `<div className="relative flex-1">` block, after the remote `<video ref={remoteRef} …/>`, add:

```tsx
        {ctrlRole === "controller" && peerSharing && (ctrl089?.status === "granted" || ctrl089?.status === "paused") && (
          <ControlInputSurface sessionId={ctrl089.sessionId} active={ctrl089.status === "granted"} />
        )}
```

(The controller drives the **call's** shared-screen video — no second room. `active` is false while paused, matching spec 088.)

- [ ] **Step 6: Add the panic hotkey (double-Esc) while control is live**

After the WS subscription effect, add:

```tsx
  useEffect(() => {
    if (!ctrl089 || (ctrl089.status !== "granted" && ctrl089.status !== "paused")) return;
    let last = 0;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (ev.timeStamp - last < 500) void revokeControl();
      last = ev.timeStamp;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctrl089, revokeControl]);
```

- [ ] **Step 7: Typecheck & lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/chats/DmCall.tsx
git commit -m "feat(089): in-call Give/Revoke Control + input surface (browser path)"
```

---

### Task 10: End-to-end verification — in-call control (browser + existing agent)

No code — a required verification gate for Phase B, using the existing spec 088 Windows agent as the injector.

- [ ] **Step 1: Two machines, LiveKit + WS configured**

Machine A (host/sharer) on Windows with the spec 088 agent available; Machine B (controller) any browser.

- [ ] **Step 2: Drive the flow**

1. A and B start a DM call. A clicks 🖥️ and shares a full screen → B sees it full-frame (Task 3). 2. A clicks 🕹️ **Give Control**. 3. A sees "Download helper" → runs the agent (embedded token). 4. On agent register, A's button shows ⛔ **Revoke** and the "🔴 {B} is controlling your screen" banner; B's cursor over the shared video drives A's machine. 5. A moves their own mouse → control auto-pauses (agent behavior); B's input is ignored until resume. 6. A clicks ⛔ (or double-Esc) → input stops within ~1s, share continues, banner clears.

- [ ] **Step 3: Confirm fail-closed**

While control is live, have A click 🛑 **Stop share** — confirm control ends (session → ended, agent exits). Repeat with A hanging up the call mid-control — same result.

- [ ] **Step 4: Record the result**

Note pass/fail per step in the PR description. If any step fails, debug with superpowers:systematic-debugging before proceeding to Phase C.

---

## Phase C — Electron desktop shell + native injection

### Task 11: Extract `injection-core` from the agent (shared module) + test

Pull the nut.js key/button maps, coordinate scaling, and message-injection loop out of `agent.mjs` into a module both the standalone agent and the Electron main import.

**Files:**
- Create: `apps/agent/src/injection-core.mjs`
- Test: `apps/agent/src/injection-core.test.mjs`
- Modify: `apps/agent/src/agent.mjs`
- Modify: `apps/agent/package.json` (add a `test` script)

**Interfaces:**
- Produces from `injection-core.mjs`:
  - `KEY` (map), `btn(b)` → nut Button, `toPixels(norm, extent)` → rounded pixel, `mapKey(key)` → nut Key | undefined.
  - `createInjector({ getScreen })` → `{ inject(input), setPaused(bool), isPaused() }` where `getScreen()` returns `{ w, h }`.

- [ ] **Step 1: Write the failing test for the pure helpers**

```js
// apps/agent/src/injection-core.test.mjs
import { describe, expect, it } from "vitest";
import { btn, toPixels, mapKey } from "./injection-core.mjs";

describe("toPixels", () => {
  it("scales a normalized coord to a rounded pixel", () => {
    expect(toPixels(0.5, 1920)).toBe(960);
    expect(toPixels(0, 1080)).toBe(0);
    expect(toPixels(1, 1080)).toBe(1080);
  });
});

describe("btn", () => {
  it("maps names to nut buttons distinctly", () => {
    expect(btn("right")).not.toBe(btn("left"));
    expect(btn("middle")).not.toBe(btn("left"));
    expect(btn("anything-else")).toBe(btn("left"));
  });
});

describe("mapKey", () => {
  it("maps known named keys and leaves single chars unmapped", () => {
    expect(mapKey("Enter")).toBeDefined();
    expect(mapKey("a")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/agent`): `pnpm exec vitest run src/injection-core.test.mjs`
Expected: FAIL — module not found. (If vitest isn't installed in `apps/agent`, add it: `pnpm add -D vitest` in `apps/agent`, then set `"test": "vitest run"` in its package.json.)

- [ ] **Step 3: Create `injection-core.mjs` (move logic from agent.mjs)**

Move the `KEY` map (agent.mjs 55–77), `btn` (79), the inject `switch` (82–124), and the screen-size handling into the module. Concretely:

```js
// apps/agent/src/injection-core.mjs
import { Button, Key, Point, keyboard, mouse } from "@nut-tree-fork/nut-js";

export const KEY = {
  Enter: Key.Enter, Backspace: Key.Backspace, Tab: Key.Tab, Escape: Key.Escape,
  " ": Key.Space, ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right,
  Delete: Key.Delete, Home: Key.Home, End: Key.End, PageUp: Key.PageUp, PageDown: Key.PageDown,
  Shift: Key.LeftShift, Control: Key.LeftControl, Alt: Key.LeftAlt, Meta: Key.LeftSuper,
  CapsLock: Key.CapsLock, Insert: Key.Insert,
};
for (let i = 1; i <= 12; i++) KEY[`F${i}`] = Key[`F${i}`];

export const btn = (b) => (b === "right" ? Button.RIGHT : b === "middle" ? Button.MIDDLE : Button.LEFT);
export const mapKey = (key) => KEY[key];
export const toPixels = (norm, extent) => Math.round(norm * extent);

mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

/**
 * Spec 089 — the injector shared by the standalone agent and the Electron main
 * process. `getScreen()` returns the target display size {w,h}; inject() applies
 * one ControlInput. Pause state gates injection (host-local-input-wins).
 */
export function createInjector({ getScreen }) {
  let paused = false;
  let lastInjectAt = 0;
  async function inject(input) {
    if (paused) return;
    lastInjectAt = Date.now();
    const { w, h } = getScreen();
    try {
      switch (input.t) {
        case "move":
          await mouse.setPosition(new Point(toPixels(input.x, w), toPixels(input.y, h)));
          break;
        case "down":
          await mouse.setPosition(new Point(toPixels(input.x, w), toPixels(input.y, h)));
          await mouse.pressButton(btn(input.button));
          break;
        case "up":
          await mouse.releaseButton(btn(input.button));
          break;
        case "scroll":
          if (input.dy < 0) await mouse.scrollUp(Math.max(1, Math.round(-input.dy / 40)));
          else if (input.dy > 0) await mouse.scrollDown(Math.max(1, Math.round(input.dy / 40)));
          if (input.dx < 0) await mouse.scrollLeft(Math.max(1, Math.round(-input.dx / 40)));
          else if (input.dx > 0) await mouse.scrollRight(Math.max(1, Math.round(input.dx / 40)));
          break;
        case "key": {
          const mapped = mapKey(input.key);
          if (mapped !== undefined) {
            if (input.down) await keyboard.pressKey(mapped);
            else await keyboard.releaseKey(mapped);
          } else if (input.down && input.key.length === 1) {
            await keyboard.type(input.key);
          }
          break;
        }
        case "text":
          await keyboard.type(input.text);
          break;
        default:
          break;
      }
    } catch {
      /* swallow — a single bad event must not kill the session */
    }
  }
  return {
    inject,
    setPaused: (p) => { paused = p; },
    isPaused: () => paused,
    lastInjectAt: () => lastInjectAt,
  };
}
```

- [ ] **Step 4: Refactor `agent.mjs` to consume the module**

In `agent.mjs`: remove the moved `KEY`, `btn`, `mouse.config`, `keyboard.config`, and `inject` (keep `screen` for size). Import and build an injector:

```js
import { screen } from "@nut-tree-fork/nut-js";
import { createInjector } from "./injection-core.mjs";
// …
let screenW = 1920, screenH = 1080;
const injector = createInjector({ getScreen: () => ({ w: screenW, h: screenH }) });
```

Replace `void inject(msg.input)` (line 150) with `void injector.inject(msg.input)`; replace `paused = true/false` (153–154) with `injector.setPaused(true/false)`; replace the `Date.now() - lastInjectAt < 250` guard (195) with `Date.now() - injector.lastInjectAt() < 250`; replace `if (!paused)` (196) with `if (!injector.isPaused())`. Keep the WS connection, token handling, and uiohook exactly as-is.

- [ ] **Step 5: Run tests + a manual agent smoke**

Run (from `apps/agent`): `pnpm exec vitest run src/injection-core.test.mjs`
Expected: PASS.
Then re-run the Task 10 flow once to confirm the refactored standalone agent still injects correctly (no behavior change).

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/injection-core.mjs apps/agent/src/injection-core.test.mjs apps/agent/src/agent.mjs apps/agent/package.json
git commit -m "refactor(089): extract shared injection-core from control agent"
```

---

### Task 12: Environment detection helper (pure) + choose injection path

A pure helper the renderer uses to decide desktop-native vs browser-download injection, plus wiring `giveControl` to skip the download on desktop.

**Files:**
- Create: `apps/web/src/lib/desktop/env.ts`
- Test: `apps/web/src/lib/desktop/env.test.ts`
- Modify: `apps/web/src/components/chats/DmCall.tsx`

**Interfaces:**
- Produces:
  - `type DesktopBridge = { isDesktop: true; startControl(token: string, wsUrl: string): void; stopControl(): void }`
  - `getDesktopBridge(): DesktopBridge | null` — reads `globalThis.yappchatDesktop`.
  - `isDesktop(): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/desktop/env.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { getDesktopBridge, isDesktop } from "./env";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).yappchatDesktop;
});

describe("desktop env", () => {
  it("reports browser when no bridge is present", () => {
    expect(isDesktop()).toBe(false);
    expect(getDesktopBridge()).toBeNull();
  });
  it("detects the injected desktop bridge", () => {
    (globalThis as Record<string, unknown>).yappchatDesktop = {
      isDesktop: true, startControl() {}, stopControl() {},
    };
    expect(isDesktop()).toBe(true);
    expect(getDesktopBridge()?.isDesktop).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/desktop/env.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/desktop/env.ts
/**
 * Spec 089 — the renderer's view of the Electron bridge (preload contextBridge).
 * Present only inside the desktop app; null in a browser → agent-download path.
 */
export type DesktopBridge = {
  isDesktop: true;
  startControl(token: string, wsUrl: string): void;
  stopControl(): void;
};

export function getDesktopBridge(): DesktopBridge | null {
  const b = (globalThis as { yappchatDesktop?: DesktopBridge }).yappchatDesktop;
  return b?.isDesktop ? b : null;
}

export function isDesktop(): boolean {
  return getDesktopBridge() !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/desktop/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Branch `giveControl` on environment**

In `DmCall.tsx`, add `import { getDesktopBridge } from "@/lib/desktop/env";` and update the `giveControl` handler (Task 9) so that, after a successful offer, the desktop path hands the token to the main process instead of showing a download:

```tsx
  const giveControl = useCallback(async () => {
    const r = await fetch(`/api/dm/${conversationId}/control/offer`, { method: "POST", credentials: "include" });
    if (!r.ok) return;
    const data = (await r.json()) as { session: CtrlSession; token: string; downloadUrl: string };
    setCtrl089(data.session);
    const bridge = getDesktopBridge();
    if (bridge) {
      bridge.startControl(data.token, process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"); // in-process inject, no download
    } else {
      setCtrlDownloadUrl(data.downloadUrl); // browser: host runs the agent
    }
  }, [conversationId]);
```

Also call `bridge?.stopControl()` inside `revokeControl` before the fetch, so the in-process injector tears down on the desktop.

- [ ] **Step 6: Typecheck, lint, test**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm exec vitest run src/lib/desktop`
Expected: PASS; no errors. (In a browser this path is unchanged — Task 10 still holds.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/desktop/env.ts apps/web/src/lib/desktop/env.test.ts apps/web/src/components/chats/DmCall.tsx
git commit -m "feat(089): desktop-env detection; skip agent download on desktop"
```

---

### Task 13: Scaffold the minimal Electron shell (`apps/desktop`)

A runnable Electron app: main window loads the deployed web UI; preload exposes `window.yappchatDesktop`; main injects via `injection-core` over the same agent WS handshake.

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/preload.ts`
- Modify: root `pnpm-workspace.yaml` if it lists packages explicitly (check; add `apps/desktop`)
- Delete: none (keep `apps/desktop/stack.md`)

**Interfaces:**
- Consumes: `@yappchat/control-agent`'s `injection-core.mjs` (`createInjector`) + `screen` size.
- Produces: `window.yappchatDesktop` matching `DesktopBridge` (Task 12).

- [ ] **Step 1: `package.json`**

```json
{
  "name": "@yappchat/desktop",
  "version": "0.1.0",
  "private": true,
  "description": "Spec 089 — minimal Electron shell: runs the YappChat web UI and injects input in-process for in-call give-control (no agent download).",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json && electron dist/main.js",
    "start": "electron dist/main.js"
  },
  "dependencies": {
    "@nut-tree-fork/nut-js": "^4.2.0",
    "ws": "^8.21.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "typescript": "^5"
  }
}
```

(Import `injection-core.mjs` by relative path `../../agent/src/injection-core.mjs` — it is plain ESM with only nut.js as a runtime dep, already present here.)

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "allowJs": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: `src/main.ts`**

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import { screen as nutScreen } from "@nut-tree-fork/nut-js";
import WebSocket from "ws";
import path from "node:path";
// injection-core is shared with the standalone agent (spec 089 Task 11).
import { createInjector } from "../../agent/src/injection-core.mjs";

const APP_URL = process.env.YAPPCHAT_DESKTOP_URL ?? "http://localhost:5175";

let control: WebSocket | null = null;

async function startControl(token: string, wsUrl: string) {
  stopControl();
  let w = 1920, h = 1080;
  try { w = await nutScreen.width(); h = await nutScreen.height(); } catch { /* defaults */ }
  const injector = createInjector({ getScreen: () => ({ w, h }) });
  const url = `${wsUrl.replace(/\/+$/, "")}/?controltoken=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  control = ws;
  ws.on("message", (raw: Buffer) => {
    let msg: any;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg.type === "control_input") void injector.inject(msg.input);
    else if (msg.type === "event" && msg.event?.type === "remotecontrol.updated") {
      const s = msg.event.payload?.status;
      if (s === "paused") injector.setPaused(true);
      else if (s === "granted") injector.setPaused(false);
      else if (s === "ended") stopControl();
    }
  });
  ws.on("close", () => { control = null; });
  ws.on("error", () => { /* fail-closed: closing follows */ });
}

function stopControl() {
  if (control) { try { control.close(); } catch { /* ignore */ } control = null; }
}

ipcMain.on("control:start", (_e, token: string, wsUrl: string) => void startControl(token, wsUrl));
ipcMain.on("control:stop", () => stopControl());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  void win.loadURL(APP_URL);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { stopControl(); if (process.platform !== "darwin") app.quit(); });
```

- [ ] **Step 4: `src/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from "electron";

// Spec 089 — the DesktopBridge the renderer reads via getDesktopBridge().
contextBridge.exposeInMainWorld("yappchatDesktop", {
  isDesktop: true,
  startControl: (token: string, wsUrl: string) => ipcRenderer.send("control:start", token, wsUrl),
  stopControl: () => ipcRenderer.send("control:stop"),
});
```

- [ ] **Step 5: Install + build**

Run (from repo root): `pnpm install` then (from `apps/desktop`) `pnpm build`.
Expected: `dist/main.js` + `dist/preload.js` produced; no TS errors. If the `injection-core.mjs` import fails to resolve types, it's JS (`allowJs`) — ensure the relative path is correct and `skipLibCheck` is on.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/package.json apps/desktop/tsconfig.json apps/desktop/src/main.ts apps/desktop/src/preload.ts
# plus pnpm-workspace.yaml if edited
git commit -m "feat(089): minimal Electron desktop shell with in-process injection bridge"
```

---

### Task 14: End-to-end verification — desktop give-control (no download)

No code — the Phase C verification gate.

- [ ] **Step 1: Run the desktop app pointed at a running web app**

Start `apps/web` (`pnpm dev` + `pnpm ws`, LiveKit configured). From `apps/desktop`: `YAPPCHAT_DESKTOP_URL=http://localhost:5175 pnpm dev`. Sign in inside the Electron window.

- [ ] **Step 2: Confirm the bridge is present**

In the Electron window devtools console: `window.yappchatDesktop?.isDesktop` → `true`.

- [ ] **Step 3: Drive in-call control with NO download**

From the desktop app (host) call a peer (browser, Machine B). Host shares a screen (🖥️), clicks 🕹️ **Give Control**. Confirm: **no "Download helper" appears**; B can immediately drive the host's machine; the host banner shows; ⛔ Revoke and double-Esc both cut input within ~1s; stopping the share or closing the app ends control (WS closes, injector stops).

- [ ] **Step 4: Confirm browser parity still holds**

Repeat Task 10 (host in a plain browser) to confirm the download fallback path is unbroken.

- [ ] **Step 5: Record results in the PR.**

---

## Final Verification

- [ ] **Full test suite:** from `apps/web` `pnpm exec vitest run`; from `apps/agent` `pnpm exec vitest run`. All green (existing 132 web + new units; new agent units).
- [ ] **Typecheck + lint:** `pnpm exec tsc --noEmit && pnpm lint` in `apps/web`; `pnpm build` in `apps/desktop`.
- [ ] **Manual gates passed:** Tasks 10 and 14 recorded as passing.
- [ ] **Spec checkback:** re-read SCOPE-089 §Success Criteria 1–6; confirm each maps to a completed task.
- [ ] **Update the spec** with a "Delta — Implemented 2026-07-18" section (mirroring spec 088's) summarizing what shipped, then register the delta if desired.
- [ ] Open a PR from `089-in-call-screen-share-and-control` → `main`.
