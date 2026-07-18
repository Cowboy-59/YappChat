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
