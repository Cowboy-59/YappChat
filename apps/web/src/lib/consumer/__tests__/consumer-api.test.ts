import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../auth/ratelimit";
import { setConsumerDepsForTests } from "../deps";
import { WELCOME_LINK_TTL_MS } from "../accounts";
import { makeTestDeps, testId, type TestDeps } from "./memory-store";
import { GET as getAccount, POST as postAccount } from "../../../app/api/consumer/accounts/route";
import { POST as postGroup } from "../../../app/api/consumer/groups/route";
import { PATCH as patchGroup } from "../../../app/api/consumer/groups/[orgid]/route";
import { DELETE as deleteMember, PUT as putMember } from "../../../app/api/consumer/groups/[orgid]/members/[userid]/route";
import { POST as postRoom } from "../../../app/api/consumer/rooms/route";
import {
  DELETE as deleteRoomMember,
  PUT as putRoomMember,
} from "../../../app/api/consumer/rooms/[conversationid]/members/[userid]/route";
import { POST as retireRoute } from "../../../app/api/consumer/rooms/[conversationid]/retire/route";

/**
 * SPEC-093 T001–T006 — the nine wxKanban consumer endpoints (wxKanban SPEC-144
 * contract C1), driven through the real route handlers and guard against an
 * in-memory store. Covers 401, the happy path, every 409, idempotency, and one
 * audit row per call with no secret in it.
 */

// [SCOPE 093 / T001] BEGIN — Consumer API test harness
const SECRET = "test-consumer-secret-0123456789";
let deps: TestDeps;

function call(method: string, body?: unknown, secret: string | null = SECRET): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers.authorization = `Bearer ${secret}`;
  return new Request("https://chat.test/api/consumer/x", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function p<T extends Record<string, string>>(v: T): { params: Promise<T> } {
  return { params: Promise.resolve(v) };
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

async function seedGroup(seatlimit: number | null): Promise<{ owner: string; orgid: string }> {
  const owner = deps.store.addUser("info@acme.com");
  const res = await postGroup(call("POST", { ownerUserid: owner, name: "Acme", seatlimit }));
  const { orgid } = (await json(res)) as { orgid: string };
  return { owner, orgid };
}

async function seedRoom(memberCount: number): Promise<{ owner: string; members: string[]; conversationid: string }> {
  const owner = deps.store.addUser("info@acme.com");
  const members = Array.from({ length: memberCount }, (_, i) => deps.store.addUser(`m${i}@acme.com`));
  const res = await postRoom(call("POST", { ownerUserid: owner, title: "Billing · KAIN", memberIds: members }));
  const { conversationid } = (await json(res)) as { conversationid: string };
  return { owner, members, conversationid };
}

beforeEach(() => {
  process.env.WXKANBAN_CONSUMER_SECRET = SECRET;
  delete process.env.WXKANBAN_CONSUMER_RATE_LIMIT;
  resetRateLimits();
  deps = makeTestDeps();
  setConsumerDepsForTests(deps);
});

afterEach(() => {
  setConsumerDepsForTests(null);
  delete process.env.WXKANBAN_CONSUMER_SECRET;
  delete process.env.WXKANBAN_CONSUMER_RATE_LIMIT;
});
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — Guard tests
describe("T001 guard: secret, rate limit, audit (FR-001, FR-007)", () => {
  it("401 with no Authorization header, nothing changes, one audit row", async () => {
    const res = await postAccount(call("POST", { email: "a@b.co" }, null));
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({ error: "unauthorized" });
    expect(deps.store.state.users.size).toBe(0);
    expect(deps.emails).toHaveLength(0);
    expect(deps.store.audits).toHaveLength(1);
    expect(deps.store.audits[0].payload).toMatchObject({ status: 401, result: "unauthorized" });
  });

  it("401 with a wrong secret, on every endpoint", async () => {
    const wrong = "wrong-secret";
    const id = testId();
    const responses = await Promise.all([
      postAccount(call("POST", { email: "a@b.co" }, wrong)),
      postGroup(call("POST", {}, wrong)),
      patchGroup(call("PATCH", { seatlimit: 1 }, wrong), p({ orgid: id })),
      putMember(call("PUT", { role: "member" }, wrong), p({ orgid: id, userid: id })),
      deleteMember(call("DELETE", undefined, wrong), p({ orgid: id, userid: id })),
      postRoom(call("POST", {}, wrong)),
      putRoomMember(call("PUT", undefined, wrong), p({ conversationid: id, userid: id })),
      deleteRoomMember(call("DELETE", undefined, wrong), p({ conversationid: id, userid: id })),
      retireRoute(call("POST", undefined, wrong), p({ conversationid: id })),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(9).fill(401));
    expect(deps.store.audits).toHaveLength(9);
  });

  it("fails closed when WXKANBAN_CONSUMER_SECRET is unset", async () => {
    delete process.env.WXKANBAN_CONSUMER_SECRET;
    const res = await postAccount(call("POST", { email: "a@b.co" }));
    expect(res.status).toBe(401);
  });

  it("accepts only the Bearer header, not a session cookie", async () => {
    const req = new Request("https://chat.test/api/consumer/accounts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "yc_session=abc", "x-consumer-secret": SECRET },
      body: JSON.stringify({ email: "a@b.co" }),
    });
    expect((await postAccount(req)).status).toBe(401);
  });

  it("429 rate_limited past the per-secret limit, audited", async () => {
    process.env.WXKANBAN_CONSUMER_RATE_LIMIT = "2";
    expect((await postAccount(call("POST", { email: "a@b.co" }))).status).toBe(200);
    expect((await postAccount(call("POST", { email: "a@b.co" }))).status).toBe(200);
    const res = await postAccount(call("POST", { email: "a@b.co" }));
    expect(res.status).toBe(429);
    expect(await json(res)).toEqual({ error: "rate_limited" });
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(deps.store.audits).toHaveLength(3);
  });

  it("never writes the secret into an audit row", async () => {
    await postAccount(call("POST", { email: "a@b.co" }));
    await postAccount(call("POST", { email: "a@b.co" }, "wrong"));
    const text = JSON.stringify(deps.store.audits);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("wrong");
  });
});
// [SCOPE 093 / T001] END

// [SCOPE 093 / T002] BEGIN — Accounts tests
describe("T002 POST /api/consumer/accounts (C1.1, FR-002)", () => {
  it("creates a new account and sends one welcome email with a set-password link", async () => {
    const res = await postAccount(call("POST", { email: " Info@Acme.com ", displayName: "Acme" }));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.created).toBe(true);
    expect(typeof body.userid).toBe("string");
    expect(deps.emails).toHaveLength(1);
    expect(deps.emails[0].to).toBe("info@acme.com");
    expect(deps.emails[0].actionUrl).toBe("https://chat.test/reset?token=tok1");
    expect(deps.store.state.resettokens).toEqual([
      {
        userid: body.userid,
        tokenhash: "hash1",
        expiresat: new Date(new Date("2026-10-24T12:00:00.000Z").getTime() + WELCOME_LINK_TTL_MS),
      },
    ]);
    expect(deps.store.audits).toHaveLength(1);
    expect(deps.store.audits[0].userid).toBe(body.userid);
  });

  it("is idempotent: 20 calls for one email give one id, one account, one email", async () => {
    const ids = new Set<unknown>();
    const created: unknown[] = [];
    for (let i = 0; i < 20; i++) {
      const body = await json(await postAccount(call("POST", { email: "info@acme.com" })));
      ids.add(body.userid);
      created.push(body.created);
    }
    expect(ids.size).toBe(1);
    expect(created.filter((c) => c === true)).toHaveLength(1);
    expect(deps.store.state.users.size).toBe(1);
    expect(deps.emails).toHaveLength(1);
    expect(deps.store.audits).toHaveLength(20);
  });

  it("links an existing account unchanged: created false, no email (US2)", async () => {
    const existing = deps.store.addUser("taken@acme.com");
    const body = await json(await postAccount(call("POST", { email: "taken@acme.com" })));
    expect(body).toEqual({ userid: existing, created: false });
    expect(deps.emails).toHaveLength(0);
  });

  it("a concurrent first call that loses the unique race links, sends no email", async () => {
    const winner = deps.store.addUser("race@acme.com");
    let first = true;
    deps.provisionUser = async () => {
      if (first) {
        first = false;
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      return { userid: winner, created: false };
    };
    const body = await json(await postAccount(call("POST", { email: "race@acme.com" })));
    expect(body).toEqual({ userid: winner, created: false });
    expect(deps.emails).toHaveLength(0);
  });

  it("400 invalid_email for a missing or malformed email", async () => {
    for (const bad of [{}, { email: "" }, { email: "nope" }, { email: 42 }]) {
      const res = await postAccount(call("POST", bad));
      expect(res.status).toBe(400);
      expect(await json(res)).toEqual({ error: "invalid_email" });
    }
    expect(deps.store.state.users.size).toBe(0);
  });
});
// [SCOPE 093 / T002] END

// [SCOPE 093 / T003] BEGIN — Group tests
describe("T003 company group (C1.2, C1.3, FR-003)", () => {
  it("creates a corporate org with the limit, the owner in the owner role", async () => {
    const { owner, orgid } = await seedGroup(5);
    expect(deps.store.state.orgs.get(orgid)).toEqual({ id: orgid, name: "Acme", plantype: "corporate", seatlimit: 5 });
    expect(deps.store.state.orgmembers).toEqual([{ orgid, userid: owner, role: "owner" }]);
  });

  it("accepts seatlimit null (unlimited)", async () => {
    const { orgid } = await seedGroup(null);
    expect(deps.store.state.orgs.get(orgid)?.seatlimit).toBeNull();
  });

  it("404 user_not_found for an unknown owner, no org created", async () => {
    const res = await postGroup(call("POST", { ownerUserid: testId(), name: "Acme", seatlimit: 5 }));
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: "user_not_found" });
    expect(deps.store.state.orgs.size).toBe(0);
  });

  it("400 for a bad body (missing seatlimit, zero, fraction, no name)", async () => {
    const owner = deps.store.addUser("info@acme.com");
    for (const bad of [
      { ownerUserid: owner, name: "Acme" },
      { ownerUserid: owner, name: "Acme", seatlimit: 0 },
      { ownerUserid: owner, name: "Acme", seatlimit: 2.5 },
      { ownerUserid: owner, name: " ", seatlimit: 5 },
      { ownerUserid: "not-a-uuid", name: "Acme", seatlimit: 5 },
    ]) {
      expect((await postGroup(call("POST", bad))).status).toBe(400);
    }
    expect(deps.store.state.orgs.size).toBe(0);
  });

  it("PATCH updates the limit", async () => {
    const { orgid } = await seedGroup(5);
    const res = await patchGroup(call("PATCH", { seatlimit: 10 }), p({ orgid }));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ orgid, seatlimit: 10 });
    expect(deps.store.state.orgs.get(orgid)?.seatlimit).toBe(10);
  });

  it("PATCH below the current members → 409 below_members { members }, unchanged", async () => {
    const { orgid } = await seedGroup(5);
    for (let i = 0; i < 3; i++) {
      const u = deps.store.addUser(`u${i}@acme.com`);
      await putMember(call("PUT", { role: "member" }), p({ orgid, userid: u }));
    }
    const res = await patchGroup(call("PATCH", { seatlimit: 2 }), p({ orgid }));
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: "below_members", members: 3 });
    expect(deps.store.state.orgs.get(orgid)?.seatlimit).toBe(5);
    // Exactly the current member count is allowed.
    expect((await patchGroup(call("PATCH", { seatlimit: 3 }), p({ orgid }))).status).toBe(200);
  });

  it("PATCH 404 org_not_found for an unknown org or a person's individual org", async () => {
    const res = await patchGroup(call("PATCH", { seatlimit: 3 }), p({ orgid: testId() }));
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: "org_not_found" });
    const personal = testId();
    deps.store.state.orgs.set(personal, { id: personal, name: "Me", plantype: "individual", seatlimit: 1 });
    expect((await patchGroup(call("PATCH", { seatlimit: 3 }), p({ orgid: personal }))).status).toBe(404);
    expect(deps.store.state.orgs.get(personal)?.seatlimit).toBe(1);
  });
});
// [SCOPE 093 / T003] END

// [SCOPE 093 / T004] BEGIN — Group member tests
describe("T004 group members (C1.4, C1.5, FR-004)", () => {
  it("US1: limit 5, five members (one admin) added directly; owner plus 5 = 6 seats used", async () => {
    const { orgid } = await seedGroup(5);
    for (let i = 0; i < 5; i++) {
      const u = deps.store.addUser(`u${i}@acme.com`);
      const res = await putMember(call("PUT", { role: i === 0 ? "admin" : "member" }), p({ orgid, userid: u }));
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ orgid, userid: u, role: i === 0 ? "admin" : "member", added: true });
    }
    const roles = deps.store.state.orgmembers.filter((m) => m.orgid === orgid).map((m) => m.role);
    expect(roles.sort()).toEqual(["admin", "member", "member", "member", "member", "owner"]);
  });

  it("past the limit → 409 seat_limit_reached { missing }, nothing added (US6)", async () => {
    const { orgid } = await seedGroup(1);
    const a = deps.store.addUser("a@acme.com");
    const b = deps.store.addUser("b@acme.com");
    expect((await putMember(call("PUT", { role: "member" }), p({ orgid, userid: a }))).status).toBe(200);
    const res = await putMember(call("PUT", { role: "member" }), p({ orgid, userid: b }));
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: "seat_limit_reached", missing: 1 });
    expect(deps.store.state.orgmembers.some((m) => m.userid === b)).toBe(false);
    expect(deps.store.audits.at(-1)?.payload).toMatchObject({ status: 409, result: "seat_limit_reached" });
  });

  it("same role again → added false; a different role re-roles (added false)", async () => {
    const { orgid } = await seedGroup(5);
    const u = deps.store.addUser("u@acme.com");
    await putMember(call("PUT", { role: "member" }), p({ orgid, userid: u }));
    const again = await json(await putMember(call("PUT", { role: "member" }), p({ orgid, userid: u })));
    expect(again.added).toBe(false);
    const rerole = await json(await putMember(call("PUT", { role: "admin" }), p({ orgid, userid: u })));
    expect(rerole).toEqual({ orgid, userid: u, role: "admin", added: false });
    expect(deps.store.state.orgmembers.find((m) => m.userid === u)?.role).toBe("admin");
  });

  it("re-roling an existing member never counts against the limit", async () => {
    const { orgid } = await seedGroup(1);
    const u = deps.store.addUser("u@acme.com");
    await putMember(call("PUT", { role: "member" }), p({ orgid, userid: u }));
    expect((await putMember(call("PUT", { role: "admin" }), p({ orgid, userid: u }))).status).toBe(200);
  });

  it("the owner cannot be re-roled or removed → 409 owner_protected", async () => {
    const { owner, orgid } = await seedGroup(5);
    const put = await putMember(call("PUT", { role: "admin" }), p({ orgid, userid: owner }));
    expect(put.status).toBe(409);
    expect(await json(put)).toEqual({ error: "owner_protected" });
    const del = await deleteMember(call("DELETE"), p({ orgid, userid: owner }));
    expect(del.status).toBe(409);
    expect(await json(del)).toEqual({ error: "owner_protected" });
    expect(deps.store.state.orgmembers.find((m) => m.userid === owner)?.role).toBe("owner");
  });

  it("DELETE removes a member; a non-member → removed false", async () => {
    const { orgid } = await seedGroup(5);
    const u = deps.store.addUser("u@acme.com");
    await putMember(call("PUT", { role: "member" }), p({ orgid, userid: u }));
    expect(await json(await deleteMember(call("DELETE"), p({ orgid, userid: u })))).toEqual({ removed: true });
    expect(await json(await deleteMember(call("DELETE"), p({ orgid, userid: u })))).toEqual({ removed: false });
  });

  it("404 for an unknown org or user; 400 for a bad role", async () => {
    const { orgid } = await seedGroup(5);
    const u = deps.store.addUser("u@acme.com");
    const noOrg = await putMember(call("PUT", { role: "member" }), p({ orgid: testId(), userid: u }));
    expect(noOrg.status).toBe(404);
    expect(await json(noOrg)).toEqual({ error: "org_not_found" });
    const noUser = await putMember(call("PUT", { role: "member" }), p({ orgid, userid: testId() }));
    expect(noUser.status).toBe(404);
    expect(await json(noUser)).toEqual({ error: "user_not_found" });
    expect((await deleteMember(call("DELETE"), p({ orgid: testId(), userid: u }))).status).toBe(404);
    expect((await putMember(call("PUT", { role: "owner" }), p({ orgid, userid: u }))).status).toBe(400);
  });
});
// [SCOPE 093 / T004] END

// [SCOPE 093 / T005] BEGIN — Room tests
describe("T005 project rooms (C1.6–C1.8, FR-005)", () => {
  it("US3: a room owned by the account, in its Projects grouping, with all 6 members", async () => {
    const { owner, members, conversationid } = await seedRoom(6);
    const room = deps.store.state.rooms.get(conversationid);
    expect(room).toMatchObject({ kind: "group", title: "Billing · KAIN", retiredat: null, channelid: deps.store.directChannel });
    const grouping = deps.store.state.groupings.find((g) => g.userid === owner);
    expect(grouping).toMatchObject({ name: "Projects", type: "projects" });
    const rm = deps.store.state.roommembers.filter((m) => m.conversationid === conversationid);
    expect(rm.find((m) => m.userid === owner)).toEqual({ conversationid, userid: owner, role: "owner", groupingid: grouping?.id });
    expect(rm.filter((m) => m.role === "member").map((m) => m.userid).sort()).toEqual([...members].sort());
  });

  it("reuses an existing projects grouping; falls back when the name Projects is taken", async () => {
    const owner = deps.store.addUser("info@acme.com");
    deps.store.state.groupings.push({ id: testId(), userid: owner, name: "Projects", type: "general" });
    await postRoom(call("POST", { ownerUserid: owner, title: "A", memberIds: [] }));
    await postRoom(call("POST", { ownerUserid: owner, title: "B", memberIds: [] }));
    const projects = deps.store.state.groupings.filter((g) => g.userid === owner && g.type === "projects");
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("wxKanban Projects");
  });

  it("404 user_not_found for an unknown owner or member; nothing is created", async () => {
    const owner = deps.store.addUser("info@acme.com");
    const res = await postRoom(call("POST", { ownerUserid: owner, title: "A", memberIds: [testId()] }));
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: "user_not_found" });
    expect((await postRoom(call("POST", { ownerUserid: testId(), title: "A", memberIds: [] }))).status).toBe(404);
    expect(deps.store.state.rooms.size).toBe(0);
    expect(deps.store.state.groupings).toHaveLength(0);
  });

  it("400 for a bad body", async () => {
    const owner = deps.store.addUser("info@acme.com");
    expect((await postRoom(call("POST", { ownerUserid: owner, title: "A" }))).status).toBe(400);
    expect((await postRoom(call("POST", { ownerUserid: owner, title: "", memberIds: [] }))).status).toBe(400);
    expect((await postRoom(call("POST", { ownerUserid: owner, title: "A", memberIds: ["x"] }))).status).toBe(400);
  });

  it("PUT adds a member; again → added false", async () => {
    const { conversationid } = await seedRoom(0);
    const u = deps.store.addUser("new@acme.com");
    expect(await json(await putRoomMember(call("PUT"), p({ conversationid, userid: u })))).toEqual({ added: true });
    expect(await json(await putRoomMember(call("PUT"), p({ conversationid, userid: u })))).toEqual({ added: false });
  });

  it("DELETE removes a member (US4); a non-member → removed false", async () => {
    const { members, conversationid } = await seedRoom(2);
    expect(await json(await deleteRoomMember(call("DELETE"), p({ conversationid, userid: members[0] })))).toEqual({
      removed: true,
    });
    expect(deps.store.state.roommembers.some((m) => m.userid === members[0])).toBe(false);
    expect(await json(await deleteRoomMember(call("DELETE"), p({ conversationid, userid: members[0] })))).toEqual({
      removed: false,
    });
  });

  it("404 room_not_found for an unknown room or a non-room conversation (a DM)", async () => {
    const u = deps.store.addUser("u@acme.com");
    const res = await putRoomMember(call("PUT"), p({ conversationid: testId(), userid: u }));
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: "room_not_found" });
    const dm = testId();
    deps.store.state.rooms.set(dm, { id: dm, kind: "person", title: "", retiredat: null, channelid: "c" });
    expect((await putRoomMember(call("PUT"), p({ conversationid: dm, userid: u }))).status).toBe(404);
    expect((await deleteRoomMember(call("DELETE"), p({ conversationid: dm, userid: u }))).status).toBe(404);
    expect((await retireRoute(call("POST"), p({ conversationid: dm }))).status).toBe(404);
    expect(deps.store.state.rooms.get(dm)?.retiredat).toBeNull();
  });
});
// [SCOPE 093 / T005] END

// [SCOPE 093 / T006] BEGIN — Retire tests
describe("T006 retire a room (C1.9, FR-006)", () => {
  it("retires: retired true with retiredat; again → the same retiredat", async () => {
    const { conversationid } = await seedRoom(1);
    const first = await json(await retireRoute(call("POST"), p({ conversationid })));
    expect(first).toEqual({ retired: true, retiredat: "2026-10-24T12:00:00.000Z" });
    deps.now = () => new Date("2026-12-01T00:00:00.000Z");
    const second = await json(await retireRoute(call("POST"), p({ conversationid })));
    expect(second).toEqual(first);
    // History is untouched: the room and every membership are still there.
    expect(deps.store.state.rooms.has(conversationid)).toBe(true);
    expect(deps.store.state.roommembers.filter((m) => m.conversationid === conversationid)).toHaveLength(2);
  });

  it("adding a member to a retired room → 409 room_retired", async () => {
    const { conversationid } = await seedRoom(0);
    await retireRoute(call("POST"), p({ conversationid }));
    const u = deps.store.addUser("late@acme.com");
    const res = await putRoomMember(call("PUT"), p({ conversationid, userid: u }));
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: "room_retired" });
    expect(deps.store.state.roommembers.some((m) => m.userid === u)).toBe(false);
  });

  it("404 room_not_found for an unknown room", async () => {
    const res = await retireRoute(call("POST"), p({ conversationid: testId() }));
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: "room_not_found" });
  });

  it("exactly one audit row per consumer call across a US1-US6 style run", async () => {
    const before = deps.store.audits.length;
    const acct = await json(await postAccount(call("POST", { email: "info@acme.com" })));
    const group = await json(
      await postGroup(call("POST", { ownerUserid: acct.userid, name: "Acme", seatlimit: 1 })),
    );
    const u = deps.store.addUser("u@acme.com");
    await putMember(call("PUT", { role: "member" }), p({ orgid: String(group.orgid), userid: u }));
    const room = await json(
      await postRoom(call("POST", { ownerUserid: acct.userid, title: "R", memberIds: [u] })),
    );
    await deleteRoomMember(call("DELETE"), p({ conversationid: String(room.conversationid), userid: u }));
    await retireRoute(call("POST"), p({ conversationid: String(room.conversationid) }));
    await postAccount(call("POST", { email: "x@acme.com" }, "bad"));
    expect(deps.store.audits.length - before).toBe(7);
  });
});
// [SCOPE 093 / T006] END

// [SCOPE 093 / T009, T010] BEGIN — Amendment A tests
function lookup(email: string | null, secret: string | null = SECRET): Request {
  const headers: Record<string, string> = {};
  if (secret !== null) headers.authorization = `Bearer ${secret}`;
  const q = email === null ? "" : `?email=${encodeURIComponent(email)}`;
  return new Request(`https://chat.test/api/consumer/accounts${q}`, { method: "GET", headers });
}

describe("T009 GET /api/consumer/accounts (C1.0, Amendment A)", () => {
  it("an existing account: exists, its id and display name; nothing created, no email", async () => {
    const id = deps.store.addUser("info@acme.com");
    const res = await getAccount(lookup(" Info@Acme.com "));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ exists: true, userid: id, displayName: "info" });
    expect(deps.store.state.users.size).toBe(1);
    expect(deps.emails).toHaveLength(0);
    expect(deps.store.state.resettokens).toHaveLength(0);
  });

  it("an unknown email: exists false, nulls, nothing created", async () => {
    expect(await json(await getAccount(lookup("nobody@acme.com")))).toEqual({ exists: false, userid: null, displayName: null });
    expect(deps.store.state.users.size).toBe(0);
    expect(deps.emails).toHaveLength(0);
  });

  it("400 invalid_email for a missing or malformed email", async () => {
    expect((await getAccount(lookup(null))).status).toBe(400);
    const res = await getAccount(lookup("not-an-email"));
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({ error: "invalid_email" });
  });

  it("401 without the secret; one audit row per call, no secret in it", async () => {
    expect((await getAccount(lookup("info@acme.com", null))).status).toBe(401);
    await getAccount(lookup("info@acme.com"));
    expect(deps.store.audits).toHaveLength(2);
    expect(JSON.stringify(deps.store.audits)).not.toContain(SECRET);
  });
});

describe("T010 room owner cannot be removed (C1.8, Amendment A)", () => {
  it("409 owner_protected for the owner; the owner stays in the room", async () => {
    const { owner, conversationid } = await seedRoom(1);
    const res = await deleteRoomMember(call("DELETE"), p({ conversationid, userid: owner }));
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: "owner_protected" });
    expect(deps.store.state.roommembers.some((m) => m.userid === owner && m.role === "owner")).toBe(true);
  });
});
// [SCOPE 093 / T009, T010] END
