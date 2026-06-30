// End-to-end check of the spec 003 pipeline against running app (:3000) + WS (:3001).
// Requires: migration 0006 applied, `pnpm dev` (app) and `pnpm ws` (engine) running.
import WebSocket from "ws";
import { uuidv7 } from "uuidv7";

const APP = "http://localhost:3000";
const WS = "ws://localhost:3001";
const ENGINE = process.env.WS_INTERNAL_URL ?? "http://localhost:3001";
const SECRET = process.env.WS_INTERNAL_SECRET ?? "dev-internal-secret-change-me";

function sessionCookieFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const m = c.match(/^yc_session=([^;]+)/);
    if (m) return `yc_session=${m[1]}`;
  }
  return null;
}

/** Open an authenticated socket and resolve once `connected` arrives. */
function openSocket(cookie) {
  const ws = new WebSocket(WS, { headers: { Cookie: cookie } });
  const events = [];
  let onConnected;
  const connected = new Promise((r) => (onConnected = r));
  ws.on("message", (data) => {
    const msg = JSON.parse(String(data));
    if (msg.type === "connected") onConnected(msg);
    events.push(msg);
  });
  return { ws, events, connected, opened: new Promise((r) => ws.on("open", r)) };
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

async function publishToEngine(event) {
  // Mirror a real publisher (broker.ts): monotonic UUID v7 id + ts.
  return fetch(`${ENGINE}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": SECRET },
    body: JSON.stringify({ id: uuidv7(), ts: Date.now(), ...event }),
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const email = `wstest${Date.now()}@example.com`;
const password = "supersecret123";
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failures++;
};

// 1) Create a user + session.
const signup = await fetch(`${APP}/api/auth/signup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, displayname: "WS Test", plan: "individual" }),
});
const cookie = sessionCookieFrom(signup);
console.log("1. signup:", signup.status, "cookie:", cookie ? "captured" : "MISSING");
if (!cookie) process.exit(1);

// 2) Unauthorized WS (no cookie) should be rejected with 4401.
await new Promise((resolve) => {
  const ws = new WebSocket(WS);
  ws.on("close", (code) => {
    check(code === 4401, `unauth WS rejected (code ${code}, expect 4401)`);
    resolve();
  });
  ws.on("error", () => {});
});

// 3) Authorized WS + auth.signed_out delivery on logout.
const a = openSocket(cookie);
await a.opened;
const connectedMsg = await a.connected;
check(Boolean(connectedMsg.sessionid), "connected handshake carries sessionid");

const gotSignout = new Promise((r) => {
  a.ws.on("message", (data) => {
    const msg = JSON.parse(String(data));
    if (msg.type === "event" && msg.event?.type === "auth.signed_out") r(true);
  });
});
await fetch(`${APP}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
const signoutResult = await Promise.race([gotSignout, delay(5000).then(() => false)]);
check(signoutResult === true, "received auth.signed_out over WS");
a.ws.terminate();

// --- The remaining checks need a fresh session (logout revoked the cookie). ---
const login = await fetch(`${APP}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const cookie2 = sessionCookieFrom(login);
if (!cookie2) {
  console.log("login for resume/typing checks failed — skipping 4-6");
  process.exit(failures ? 2 : 0);
}

const CH = `channel:e2e-${Date.now()}`;

// 4) Replay/resume: event published while disconnected is replayed on reconnect.
const b = openSocket(cookie2);
await b.opened;
await b.connected;
send(b.ws, { action: "subscribe", scope: CH });
await delay(150);
await publishToEngine({ type: "message.inbound", scope: CH, payload: { n: 1 } });
await delay(200);
const firstEvent = b.events.find((m) => m.type === "event" && m.event.scope === CH);
const lastEventId = firstEvent?.event.id;
check(Boolean(lastEventId), "received first channel event (cursor captured)");
b.ws.terminate();
await delay(150);

// publish a SECOND event while disconnected
await publishToEngine({ type: "message.inbound", scope: CH, payload: { n: 2 } });
await delay(150);

// reconnect, re-subscribe, resume from lastEventId
const c = openSocket(cookie2);
await c.opened;
await c.connected;
send(c.ws, { action: "subscribe", scope: CH });
await delay(150);
send(c.ws, { action: "resume", lastEventId });
await delay(400);
const replayed = c.events.filter((m) => m.type === "event" && m.event.scope === CH);
const sawReplayStart = c.events.some((m) => m.type === "replay_start");
check(sawReplayStart && replayed.some((m) => m.event.payload?.n === 2), "resume replayed the missed event (n=2)");
check(!replayed.some((m) => m.event.payload?.n === 1), "resume did not duplicate the already-seen event (n=1)");

// 5) Typing: typing_start routes to another subscriber on the same channel.
const watcher = openSocket(cookie2);
await watcher.opened;
await watcher.connected;
send(watcher.ws, { action: "subscribe", scope: CH });
await delay(150);
send(c.ws, { action: "typing", channelid: CH.slice("channel:".length) });
await delay(300);
const gotTyping = watcher.events.some((m) => m.type === "event" && m.event.type === "message.typing_start");
check(gotTyping, "typing_start routed to channel subscriber");

c.ws.terminate();
watcher.ws.terminate();

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed ✓");
process.exitCode = failures ? 2 : 0;
