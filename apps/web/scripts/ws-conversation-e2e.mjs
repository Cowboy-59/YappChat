// Spec 001 T009 — live check of the membership-gated conversation:{id} scope.
// Proves: a conversationmembers row lets a user subscribe conversation:{id} and
// receive its messages; a non-member is rejected (unauthorized_scope).
// Requires: migration 0007 applied, `pnpm dev` (:3000) + `pnpm ws` (:3001) running.
import WebSocket from "ws";
import { uuidv7 } from "uuidv7";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const APP = "http://localhost:3000";
const WS = "ws://localhost:3001";

function db() {
  const u = new URL(process.env.DATABASE_URL);
  const schema = u.searchParams.get("schema") ?? "yappchat";
  const ssl = u.searchParams.get("sslmode") === "require" ? "require" : undefined;
  u.search = "";
  return { sql: postgres(u.toString(), { ssl, prepare: false, max: 1 }), schema };
}

function cookieFrom(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const m = c.match(/^yc_session=([^;]+)/);
    if (m) return `yc_session=${m[1]}`;
  }
  return null;
}
function openSocket(cookie) {
  const ws = new WebSocket(WS, { headers: { Cookie: cookie } });
  const events = [];
  let onConnected;
  const connected = new Promise((r) => (onConnected = r));
  ws.on("message", (d) => {
    const msg = JSON.parse(String(d));
    if (msg.type === "connected") onConnected(msg);
    events.push(msg);
  });
  return { ws, events, connected, opened: new Promise((r) => ws.on("open", r)) };
}
const send = (ws, m) => ws.send(JSON.stringify(m));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "PASS" : "FAIL"}: ${label}`); if (!ok) failures++; };
async function signup(tag) {
  const res = await fetch(`${APP}/api/auth/signup`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `conv-${tag}-${Date.now()}@example.com`, password: "supersecret123", displayname: tag, plan: "individual" }),
  });
  return cookieFrom(res);
}

const { sql, schema } = db();
try {
  // Member A: account + socket (handshake gives userid) + a channel/conversation.
  const cookieA = await signup("A");
  const a = openSocket(cookieA); await a.opened;
  const connA = await a.connected;
  const useridA = connA.userid;
  check(Boolean(useridA), "member A connected (userid captured)");

  const chRes = await fetch(`${APP}/api/engine/channels`, {
    method: "POST", headers: { "content-type": "application/json", Cookie: cookieA }, body: JSON.stringify({ name: "T009 verify" }),
  });
  const channelid = (await chRes.json()).channel.id;
  const convRes = await fetch(`${APP}/api/engine/channels/${channelid}/conversations`, {
    method: "POST", headers: { "content-type": "application/json", Cookie: cookieA }, body: JSON.stringify({ title: "members-only" }),
  });
  const convid = (await convRes.json()).conversation.id;

  // Grant A membership directly (no HTTP route yet — that's spec 017's job).
  await sql`insert into ${sql(schema)}.conversationmembers (id, conversationid, userid) values (${uuidv7()}, ${convid}, ${useridA})`;

  // A (member) may subscribe conversation:{id}.
  send(a.ws, { action: "subscribe", scope: `conversation:${convid}` });
  await delay(250);
  check(a.events.some((m) => m.type === "subscribed" && m.scope === `conversation:${convid}`), "member A subscribe ACCEPTED");

  // B (non-member) is rejected.
  const cookieB = await signup("B");
  const b = openSocket(cookieB); await b.opened; await b.connected;
  send(b.ws, { action: "subscribe", scope: `conversation:${convid}` });
  await delay(800);
  const bSubscribed = b.events.some((m) => m.type === "subscribed" && m.scope === `conversation:${convid}`);
  const bRejected = b.events.some((m) => m.type === "error" && String(m.error).startsWith("unauthorized_scope:"));
  check(bRejected && !bSubscribed, "non-member B subscribe REJECTED");

  // A posts a message; it must reach A over the conversation scope, not B.
  await fetch(`${APP}/api/engine/conversations/${convid}/messages`, {
    method: "POST", headers: { "content-type": "application/json", Cookie: cookieA }, body: JSON.stringify({ content: "members only 🔒" }),
  });
  await delay(400);
  const aGot = a.events.some((m) => m.type === "event" && m.event?.scope === `conversation:${convid}`);
  const bGot = b.events.some((m) => m.type === "event" && m.event?.scope === `conversation:${convid}`);
  check(aGot, "member A received the conversation message");
  check(!bGot, "non-member B did NOT receive it");

  a.ws.terminate(); b.ws.terminate();
  // Cleanup the throwaway rows.
  await sql`delete from ${sql(schema)}.conversationmembers where conversationid = ${convid}`;
  await sql`delete from ${sql(schema)}.channels where id = ${channelid}`;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed ✓");
process.exitCode = failures ? 2 : 0;
