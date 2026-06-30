// Spec 017 T002 — join / approval / invite / moderation / audit, end-to-end.
// Requires: migrations through 0009 applied, `pnpm dev` (:3000) + `pnpm ws` (:3001).
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
    body: JSON.stringify({ email: `t2-${tag}-${Date.now()}-${Math.floor(performance.now())}@example.com`, password: "supersecret123", displayname: tag, plan: "individual" }),
  });
  return cookieFrom(res);
}
const jget = (p, c) => fetch(`${APP}${p}`, { headers: { Cookie: c } });
const jpost = (p, c, b) => fetch(`${APP}${p}`, { method: "POST", headers: { "content-type": "application/json", Cookie: c }, body: JSON.stringify(b ?? {}) });
const jpatch = (p, c, b) => fetch(`${APP}${p}`, { method: "PATCH", headers: { "content-type": "application/json", Cookie: c }, body: JSON.stringify(b) });
const jdelete = (p, c) => fetch(`${APP}${p}`, { method: "DELETE", headers: { Cookie: c } });

function openSocket(cookie) {
  const ws = new WebSocket(WS, { headers: { Cookie: cookie } });
  const events = [];
  let onC; const connected = new Promise((r) => (onC = r));
  ws.on("message", (d) => { const m = JSON.parse(String(d)); if (m.type === "connected") onC(m); events.push(m); });
  return { ws, events, connected, opened: new Promise((r) => ws.on("open", r)) };
}
const send = (ws, m) => ws.send(JSON.stringify(m));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? "PASS" : "FAIL"}: ${label}`); if (!ok) failures++; };
async function canSubscribe(cookie, scope) {
  const s = openSocket(cookie); await s.opened; await s.connected;
  send(s.ws, { action: "subscribe", scope });
  await delay(900);
  const ok = s.events.some((m) => m.type === "subscribed" && m.scope === scope);
  const rejected = s.events.some((m) => m.type === "error" && String(m.error).startsWith("unauthorized_scope:"));
  s.ws.terminate();
  return { ok, rejected };
}

// Owner creates an approval community + space.
const owner = await signup("owner");
const community = (await (await jpost("/api/communities", owner, { name: "wxKanban T2", joinpolicy: "approval", discoverability: "public" })).json()).community;
const space = (await (await jpost(`/api/communities/${community.id}/spaces`, owner, { name: "support" })).json()).space;
const convScope = `conversation:${space.conversationid}`;

// B requests to join → pending; owner approves → member; B can message in space.
const b = await signup("bea");
const bJoin = await jpost(`/api/communities/${community.id}/join`, b, {});
const bJoinBody = await bJoin.json();
check(bJoin.status === 202 && bJoinBody.status === "pending", "approval policy → join request is pending (202)");

const reqs = await (await jget(`/api/communities/${community.id}/requests`, owner)).json();
const reqB = reqs.requests?.[0];
check(Boolean(reqB), "owner sees the pending request in the queue");

const approve = await jpost(`/api/communities/${community.id}/requests/${reqB.id}`, owner, { decision: "approve" });
check(approve.status === 200, "owner approves the request");
check((await canSubscribe(b, convScope)).ok, "approved member B can subscribe the space conversation (synced)");

// Invite flow: owner mints an invite; C joins with it instantly (bypasses approval).
const invite = (await (await jpost(`/api/communities/${community.id}/invites`, owner, {})).json()).invite;
const c = await signup("cas");
const cJoin = await jpost(`/api/communities/${community.id}/join`, c, { inviteToken: invite.token });
check(cJoin.status === 200 && (await cJoin.json()).status === "member", "invite token → instant member (bypasses approval)");

// D requests then is denied → never a member.
const d = await signup("dan");
await jpost(`/api/communities/${community.id}/join`, d, {});
const reqsNow = (await (await jget(`/api/communities/${community.id}/requests`, owner)).json()).requests;
const reqD = reqsNow.find((r) => r.id !== reqB.id);
await jpost(`/api/communities/${community.id}/requests/${reqD.id}`, owner, { decision: "deny" });
check((await canSubscribe(d, convScope)).rejected, "denied user D cannot access the space");

// Gate: B (plain member) cannot list the request queue; promote B to moderator → can.
check((await jget(`/api/communities/${community.id}/requests`, b)).status === 403, "plain member cannot see the moderation queue (403)");
const promote = await jpatch(`/api/communities/${community.id}/members/${reqB.userid}`, owner, { role: "moderator" });
check(promote.status === 200, "owner promotes B to moderator");
check((await jget(`/api/communities/${community.id}/requests`, b)).status === 200, "moderator B can now see the queue");

// Remove C → loses space access.
const remove = await jdelete(`/api/communities/${community.id}/members/${await getUid(c)}`, owner);
check(remove.status === 200, "owner removes member C");
check((await canSubscribe(c, convScope)).rejected, "removed member C can no longer access the space");

// Last-owner protection.
const selfDemote = await jpatch(`/api/communities/${community.id}/members/${await getUid(owner)}`, owner, { role: "member" });
check(selfDemote.status === 409, "last owner cannot be demoted (409)");

// Audit trail is populated.
const audit = (await (await jget(`/api/communities/${community.id}/audit`, owner)).json()).audit;
const types = new Set((audit ?? []).map((a) => a.eventtype));
check(["join_approved", "member_joined", "role_changed", "member_removed", "invite_created"].every((t) => types.has(t)), "audit log captured the governance events");

async function getUid(cookie) {
  const me = await (await jget("/api/auth/me", cookie)).json();
  return me.user?.id ?? me.id;
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed ✓");
process.exitCode = failures ? 2 : 0;
