# YappChat Control Agent (spec 088)

An ephemeral, **input-only**, single-use Windows helper. The person being helped
runs it once per session; it injects the controller's mouse/keyboard and
self-terminates when the session ends. The screen video rides LiveKit — this
agent never captures the screen. It connects **outbound only** (no inbound port).

## What it does

- Connects to the YappChat WS engine with a **single-use control token**
  (`?controltoken=…`) minted when the host clicks **Allow control**.
- Maps **normalized [0,1]** pointer coordinates → the real primary display and
  injects mouse move/click/scroll + keyboard (via [`@nut-tree-fork/nut-js`]).
- With the optional `uiohook-napi` native dep: a **global panic hotkey**
  (double-Esc) and **local-input auto-pause** (the host touching their own
  mouse/keyboard pauses remote control). Without it, the browser **Stop** button
  and connection-drop still end control.
- Exits the moment the session ends (`remotecontrol.updated` → `ended`), the
  socket closes, or the panic hotkey fires. No standing install, no unattended
  access.

## Install (once, on the machine to be controlled)

```
cd apps/agent
npm install          # pulls nut-js (+ optional uiohook-napi) prebuilt binaries
npm install -g .     # exposes the `yappchat-control-agent` command (or: npm link)
```

> `uiohook-napi` is an **optional** dependency. If its install fails, the agent
> still runs — you just lose the global panic hotkey + auto-pause (the in-app
> Stop button remains).

## Run

Normally you don't run it by hand: in a YappChat DM the host clicks **Allow
control**, downloads **`yappchat-control.cmd`**, and double-clicks it. That
launcher sets the token + WS URL and starts the agent.

Manual equivalent:

```
set YAPPCHAT_WS_URL=ws://localhost:3011        REM prod: wss://ws.wxperts.com
yappchat-control-agent --token=<TOKEN_FROM_ALLOW>
```

## Two-machine test

1. **Machine A (controller)** and **Machine B (host)** each sign into YappChat and
   open the same 1:1 DM.
2. B installs the agent (above), once.
3. A clicks **🖥️ Request control** in the DM header.
4. B clicks **Allow**, downloads `yappchat-control.cmd`, runs it (a console opens:
   "connected. Control is live").
5. B is prompted to **share their entire screen** (LiveKit). A now sees B's screen
   and can drive the mouse/keyboard.
6. B moving their own mouse **pauses** control; **double-Esc** or **Stop** (either
   side) ends it, and the agent process exits.

## Package to a signed exe (productionization)

`npm run package` bundles a `dist/yappchat-agent.exe` (via `pkg`). Native
addons (`nut-js`, `uiohook-napi`) must be shipped alongside / unpacked; then
**code-sign** the exe so SmartScreen/AV don't flag an input-injecting binary.
At that point, change `/api/agent/download` to serve the signed exe from storage
instead of the `.cmd` launcher.

[`@nut-tree-fork/nut-js`]: https://github.com/nut-tree/nut.js
