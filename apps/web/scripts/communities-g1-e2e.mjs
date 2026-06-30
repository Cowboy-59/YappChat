// Spec 017 T001 (Communities G1) — end-to-end foundation check.
// Create community + spaces, capability/membership gates, stricter-override rule,
// and live messaging in a space's membership-gated conversation (spec 001 T009).
// Requires: migrations through 0008 applied, `pnpm dev` (:3000) + `pnpm ws` (:3001).
import WebSocket from "ws";

const APP = "http://localhost:3000";
const WS = "ws://localhost:3001";

function cookieFrom(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const m = c.match(/^yc_session=([^;]+)/);
    if (m) return `yc_session=${m[1]}`;
  }
  return null;
}
async function signup(tag) {
  const res = await fetch(`${APP}/api/auth/signup`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `g1-${tag}-${Date.now()}@example.com`, password: "supersecret123", displayname: tag, plan: "individual" }),
  });
  return cookieFrom(res);
}
const jget = (path, cookie) => fetch(`${APP}${path}`, { headers: { Cookie: cookie } });
const jpost = (path, cookie, body) =>
  fetch(`${APP}${path}`, { method: "POST", headers: { "content-type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
const jpatch = (path, cookie, body) =>
  fetch(`${APP}${path}`, { method: "PATCH", headers: { "content-type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });

function openSocket(cookie) {
  const ws = new WebSocket(WS, { headers: { Cookie: cookie } });
  const events = [];
  let onConnected;
  const connected = new Promise((r) => (onConnected = r));
  ws.on("message", (d) => { const m = JSON.parse(String(d)); if (m.type === "connected") onConnected(m); events.push(m); });
  return { ws, events, connected, opened: new Promise((r) => ws.on("open", r)) };
}
const send = (ws, m) => ws.send(JSON.stringify(m));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "PASS" : "FAIL"}: ${label}`); if (!ok) failures++; };

// Owner creates a community + space.
const owner = await signup("owner");
const cRes = await jpost("/api/communities", owner, { name: "wxKanban", discoverability: "public", joinpolicy: "approval" });
const community = (await cRes.json()).community;
check(cRes.status === 201 && community?.id && community.slug.startsWith("wxkanban"), "owner created community (slug derived)");

const mine = await (await jget("/api/communities", owner)).json();
check(mine.communities?.some((c) => c.id === community.id && c.role === "owner"), "owner sees it in their list as owner");

const sRes = await jpost(`/api/communities/${community.id}/spaces`, owner, { name: "support", topic: "help" });
const space = (await sRes.json()).space;
check(sRes.status === 201 && space?.conversationid, "owner created a space (backed by a conversation)");

// Capability + override rules.
const patchOk = await jpatch(`/api/communities/${community.id}`, owner, { description: "wxKanban beta + support" });
check(patchOk.status === 200, "owner can update the community (capability community:update)");

const looser = await jpost(`/api/communities/${community.id}/spaces`, owner, { name: "open-room", joinpolicy: "open" });
check(looser.status === 400, "space with a LOOSER join policy than the community is rejected (400)");

const stricter = await jpost(`/api/communities/${community.id}/spaces`, owner, { name: "beta", joinpolicy: "invite" });
check(stricter.status === 201, "space with a STRICTER join policy is allowed");

// Non-member is blocked everywhere (404 — existence not leaked).
const outsider = await signup("outsider");
const oGet = await jget(`/api/communities/${community.id}`, outsider);
check(oGet.status === 404, "non-member GET community → 404");
const oSpace = await jpost(`/api/communities/${community.id}/spaces`, outsider, { name: "sneaky" });
check(oSpace.status === 404, "non-member create space → 404");

// Live messaging in the space's gated conversation (spec 001 T009).
const convScope = `conversation:${space.conversationid}`;
const a = openSocket(owner); await a.opened; await a.connected;
send(a.ws, { action: "subscribe", scope: convScope });
await delay(900);
check(a.events.some((m) => m.type === "subscribed" && m.scope === convScope), "owner (space member) can subscribe the space conversation");

const b = openSocket(outsider); await b.opened; await b.connected;
send(b.ws, { action: "subscribe", scope: convScope });
await delay(600);
check(b.events.some((m) => m.type === "error" && String(m.error).startsWith("unauthorized_scope:")), "outsider subscribe to the space conversation REJECTED");

await jpost(`/api/engine/conversations/${space.conversationid}/messages`, owner, { content: "welcome to wxKanban support 👋" });
await delay(500);
check(a.events.some((m) => m.type === "event" && m.event?.scope === convScope), "owner received the space message live");
check(!b.events.some((m) => m.type === "event" && m.event?.scope === convScope), "outsider did NOT receive it");

a.ws.terminate(); b.ws.terminate();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed ✓");
process.exitCode = failures ? 2 : 0;
