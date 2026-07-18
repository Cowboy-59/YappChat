import { app, BrowserWindow, ipcMain } from "electron";
import { screen as nutScreen } from "@nut-tree-fork/nut-js";
import WebSocket from "ws";
import path from "node:path";
import { pathToFileURL } from "node:url";
// injection-core is shared with the standalone agent (spec 089 Task 11).
// It is a plain ESM module (.mjs); this file compiles to CommonJS, so a
// static `import` of it would throw ERR_REQUIRE_ESM at runtime. A plain
// `await import(...)` doesn't fix that: with "module": "CommonJS", tsc
// downlevels dynamic import() into `require()`, which throws the same
// ERR_REQUIRE_ESM for an .mjs target. Routing the call through `new
// Function` hides the import() expression from tsc's static rewrite, so the
// emitted JS keeps a real, native dynamic import at runtime — the only way
// to load an ESM module from a CommonJS file without a require() downlevel.
const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;

const APP_URL = process.env.YAPPCHAT_DESKTOP_URL ?? "http://localhost:5175";

let control: WebSocket | null = null;

// Spec 089 Task 13b — OS-global panic + host-input auto-pause, mirroring
// apps/agent/src/agent.mjs's startGlobalHooks()/sendPause()/sendResume() so the
// kill-switch works even when the Electron window is unfocused. uiohook-napi is
// an optional native dep (uiohook-napi); if it's not installed, control still
// works — just without the global panic hotkey / auto-pause, same graceful
// degradation as the standalone agent.
let activeUiohook: any = null;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

function startGlobalHooks(ws: WebSocket, injector: any) {
  let uiohook: any = null;
  try {
    uiohook = require("uiohook-napi").uIOhook;
  } catch {
    uiohook = null;
  }
  if (!uiohook) {
    console.log("[yappchat-desktop] uiohook-napi not installed — global panic hotkey/auto-pause disabled.");
    return;
  }

  const sendPause = () => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "control_pause", sessionId: "" }));
  };
  const sendResume = () => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "control_resume", sessionId: "" }));
  };
  const autoPause = () => {
    // Ignore events we just caused by injecting.
    if (Date.now() - injector.lastInjectAt() < 250) return;
    if (!injector.isPaused()) sendPause();
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => sendResume(), 1500);
  };

  let lastEsc = 0;
  uiohook.on("keydown", (e: any) => {
    // Esc == keycode 1 in uiohook. Double-press within 500ms = panic.
    if (e.keycode === 1) {
      const now = Date.now();
      if (now - lastEsc < 500) {
        stopControl();
        return;
      }
      lastEsc = now;
    }
    autoPause();
  });
  uiohook.on("mousemove", autoPause);
  uiohook.on("mousedown", autoPause);

  try {
    uiohook.start();
    activeUiohook = uiohook;
    console.log("[yappchat-desktop] global panic hotkey (double-Esc) + host-input auto-pause active.");
  } catch (err: any) {
    console.log("[yappchat-desktop] could not start global hooks:", err?.message ?? String(err));
  }
}

function stopGlobalHooks() {
  if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  if (activeUiohook) {
    try { activeUiohook.stop(); } catch { /* ignore */ }
    activeUiohook = null;
  }
}

async function startControl(token: string, wsUrl: string) {
  stopControl();
  let w = 1920, h = 1080;
  try { w = await nutScreen.width(); h = await nutScreen.height(); } catch { /* defaults */ }
  const coreUrl = pathToFileURL(path.join(__dirname, "../../agent/src/injection-core.mjs")).href;
  const { createInjector } = await dynamicImport(coreUrl);
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
    } else if (msg.type === "error") stopControl();
  });
  ws.on("close", () => { control = null; });
  ws.on("error", () => { /* fail-closed: closing follows */ });
  startGlobalHooks(ws, injector);
}

function stopControl() {
  stopGlobalHooks();
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
