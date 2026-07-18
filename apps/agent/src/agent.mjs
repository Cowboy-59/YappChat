#!/usr/bin/env node
/**
 * Spec 088 — YappChat remote-control helper agent (Windows, input-only).
 *
 * The person being helped runs this once per session. It:
 *   1. connects OUTBOUND to the YappChat WS engine with a single-use token
 *      (?controltoken=…) — no inbound port / firewall change;
 *   2. injects the controller's mouse/keyboard (nut.js) mapped from NORMALIZED
 *      [0,1] coordinates to the real primary display;
 *   3. (optional, if uiohook-napi is present) registers a GLOBAL panic hotkey
 *      (double-Esc) and auto-pauses when the host touches their own input;
 *   4. self-terminates the moment the session ends, or the connection drops.
 *
 * There is NO standing install and NO unattended access: the token dies with the
 * session, and closing this process (or the panic hotkey) ends control at once.
 *
 * Run:  node agent.mjs --token=<TOKEN> --ws=<wss://ws.host>
 *   or set YAPPCHAT_CONTROL_TOKEN / YAPPCHAT_WS_URL.
 */

import { createRequire } from "node:module";
import WebSocket from "ws";
import { screen } from "@nut-tree-fork/nut-js";
import { createInjector } from "./injection-core.mjs";

// For the optional native dep (uiohook-napi), loaded via require() in ESM.
const require = createRequire(import.meta.url);

// ── args / config ────────────────────────────────────────────────────────────
function arg(name) {
  const pfx = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pfx));
  return hit ? hit.slice(pfx.length) : undefined;
}
const TOKEN = arg("token") ?? process.env.YAPPCHAT_CONTROL_TOKEN;
const WS_URL = (arg("ws") ?? process.env.YAPPCHAT_WS_URL ?? "wss://ws.wxperts.com").replace(/\/+$/, "");

function log(...m) {
  console.log(`[yappchat-agent] ${m.join(" ")}`);
}
function die(msg, code = 1) {
  log(msg);
  process.exit(code);
}
if (!TOKEN) die("No control token. Pass --token=<TOKEN> (from the YappChat 'Allow control' prompt).");

let screenW = 1920;
let screenH = 1080;

// ── injection (shared with the future Electron main process — spec 089) ───────
const injector = createInjector({
  getScreen: () => ({ w: screenW, h: screenH }),
  onError: (err) => log("inject error:", err?.message ?? String(err)),
});

// ── connection ────────────────────────────────────────────────────────────────
const url = `${WS_URL}/?controltoken=${encodeURIComponent(TOKEN)}`;
log(`connecting to ${WS_URL} …`);
const ws = new WebSocket(url);

ws.on("open", async () => {
  try {
    screenW = await screen.width();
    screenH = await screen.height();
  } catch {
    /* keep defaults */
  }
  log(`connected. Screen ${screenW}×${screenH}. Control is live — close this window to stop.`);
  startGlobalHooks();
});

ws.on("message", (raw) => {
  let msg;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    return;
  }
  if (msg.type === "control_input") {
    void injector.inject(msg.input);
  } else if (msg.type === "event" && msg.event?.type === "remotecontrol.updated") {
    const status = msg.event.payload?.status;
    if (status === "paused") injector.setPaused(true);
    else if (status === "granted") injector.setPaused(false);
    else if (status === "ended") die("session ended — exiting.", 0);
  } else if (msg.type === "error") {
    die(`server rejected the agent: ${msg.error}`, 1);
  }
});

ws.on("close", () => die("connection closed — exiting.", 0));
ws.on("error", (err) => log("ws error:", err?.message ?? String(err)));

function sendPause() {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "control_pause", sessionId: "" }));
}
function sendResume() {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "control_resume", sessionId: "" }));
}

// ── optional global hooks: panic hotkey + host-activity auto-pause ─────────────
function startGlobalHooks() {
  let uiohook;
  try {
    // Optional native dep. If absent, the browser Stop button + connection-drop
    // still end control; only the GLOBAL panic hotkey/auto-pause are unavailable.
    ({ uIOhook: uiohook } = require("uiohook-napi"));
  } catch {
    log("uiohook-napi not installed — global panic hotkey/auto-pause disabled (browser Stop still works).");
    return;
  }
  let lastEsc = 0;
  let resumeTimer = null;
  uiohook.on("keydown", (e) => {
    // Esc == keycode 1 in uiohook. Double-press within 500ms = panic.
    if (e.keycode === 1) {
      const now = Date.now();
      if (now - lastEsc < 500) die("panic hotkey — control cut.", 0);
      lastEsc = now;
    }
    autoPause();
  });
  const autoPause = () => {
    // Ignore events we just caused by injecting.
    if (Date.now() - injector.lastInjectAt() < 250) return;
    if (!injector.isPaused()) {
      sendPause();
    }
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => sendResume(), 1500);
  };
  uiohook.on("mousemove", autoPause);
  uiohook.on("mousedown", autoPause);
  try {
    uiohook.start();
    log("global panic hotkey (double-Esc) + local-input auto-pause active.");
  } catch (err) {
    log("could not start global hooks:", err?.message ?? String(err));
  }
}

process.on("SIGINT", () => die("interrupted — exiting.", 0));
