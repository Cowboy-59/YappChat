import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SPEC-093 T006 — a retired room takes no new message on any posting path, and
 * is hidden from every member's room list except its owner's. The engine and the
 * room list run against a scripted fake database (no Postgres, no network): each
 * `select` chain resolves to the next queued result, and every insert is recorded
 * so the test can prove nothing was written.
 *
 * Posting paths covered:
 *  - sendMessage — POST /api/engine/conversations/:id/messages, both the web
 *    session caller and the agent `yca_` token caller (the same function);
 *  - postSystemMessage — system / bot posts (space AI, contacts, groupings, support);
 *  - ingestInbound — POST /api/engine/channels/:id/ingest with a conversationid.
 * The WebSocket server (src/server/ws.ts) has no message-posting action
 * (ClientMessage: ping, heartbeat, subscribe, unsubscribe, resume, typing,
 * typing_stop, control_*), so there is no WebSocket path to refuse.
 */

// [SCOPE 093 / T006] BEGIN — Scripted fake database
const fake = vi.hoisted(() => {
  const state = { selects: [] as unknown[][], inserts: [] as string[], updates: 0 };
  function chain(result: () => unknown[]): unknown {
    const target = () => undefined;
    return new Proxy(target, {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            try {
              resolve(result());
            } catch (e) {
              reject(e);
            }
          };
        }
        return () => chain(result);
      },
    });
  }
  const db = {
    select: () => chain(() => state.selects.shift() ?? []),
    insert: (table: unknown) => {
      state.inserts.push(String((table as { [k: symbol]: unknown })[Symbol.for("drizzle:Name")] ?? "table"));
      return chain(() => []);
    },
    update: () => {
      state.updates += 1;
      return chain(() => []);
    },
    delete: () => chain(() => []),
  };
  return { state, db };
});

vi.mock("../../db/client", () => ({ getDb: () => fake.db }));
vi.mock("../../ws/broker", () => ({ publishEvent: async () => undefined }));
// [SCOPE 093 / T006] END

import { ingestInbound, postSystemMessage, sendMessage } from "../../engine/service";
import { listMyChats } from "../../contacts/service";
import { EngineError } from "../../engine/errors";
import { assertConversationOpen, isRetiredHiddenFor } from "../retired";

// [SCOPE 093 / T006] BEGIN — Retired-room path tests
const RETIRED = new Date("2026-10-24T12:00:00.000Z");
const CONV = "00000000-0000-7000-8000-00000000c0de";

function conversation(retiredat: Date | null) {
  return { id: CONV, channelid: "ch", title: "Billing · KAIN", kind: "group", externalid: null, lastmessageat: RETIRED, createdat: RETIRED, retiredat };
}

async function expectRetired(p: Promise<unknown>): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(EngineError);
  await p.catch((e: EngineError) => {
    expect(e.code).toBe("room_retired");
    expect(e.status).toBe(409);
  });
}

beforeEach(() => {
  fake.state.selects = [];
  fake.state.inserts = [];
  fake.state.updates = 0;
});

describe("T006 retired-room predicate", () => {
  it("assertConversationOpen refuses only a retired conversation", () => {
    expect(() => assertConversationOpen({ retiredat: null })).not.toThrow();
    expect(() => assertConversationOpen({})).not.toThrow();
    expect(() => assertConversationOpen({ retiredat: RETIRED })).toThrow(EngineError);
  });

  it("isRetiredHiddenFor hides a retired room from everyone but the owner", () => {
    expect(isRetiredHiddenFor({ retiredat: RETIRED, role: "member" })).toBe(true);
    expect(isRetiredHiddenFor({ retiredat: RETIRED, role: "admin" })).toBe(true);
    expect(isRetiredHiddenFor({ retiredat: RETIRED, role: "owner" })).toBe(false);
    expect(isRetiredHiddenFor({ retiredat: null, role: "member" })).toBe(false);
  });
});

describe("T006 posting to a retired room is refused on every path", () => {
  it("sendMessage (web session and agent-token route) → 409 room_retired, nothing written", async () => {
    fake.state.selects.push([conversation(RETIRED)]);
    await expectRetired(sendMessage({ conversationid: CONV, authorid: "u1", content: "hello" }));
    expect(fake.state.inserts).toEqual([]);
    expect(fake.state.updates).toBe(0);
  });

  it("postSystemMessage (system / bot posts) → 409 room_retired, nothing written", async () => {
    fake.state.selects.push([conversation(RETIRED)]);
    await expectRetired(postSystemMessage({ conversationid: CONV, authorid: "yappchat-project", content: "hi" }));
    expect(fake.state.inserts).toEqual([]);
  });

  it("ingestInbound into a retired conversation → 409 room_retired, nothing written", async () => {
    fake.state.selects.push([{ id: "ch", platformid: "slack", name: "x" }], [{ retiredat: RETIRED }]);
    await expectRetired(ingestInbound("ch", { authorid: "ext", content: "hi", conversationid: CONV }));
    expect(fake.state.inserts).toEqual([]);
  });

  it("an active room still reaches the insert (the check does not block normal posts)", async () => {
    fake.state.selects.push([conversation(null)]);
    // Gets past the retired check to the message insert; the fake then returns no
    // row for the re-read, so the call fails later for an unrelated reason.
    await postSystemMessage({ conversationid: CONV, authorid: "bot", content: "hi" }).catch(() => undefined);
    expect(fake.state.inserts.length).toBeGreaterThan(0);
  });
});

describe("T006 the room list hides retired rooms from members, not the owner", () => {
  const row = (role: string, retiredat: Date | null, id = CONV) => ({
    id,
    kind: "group",
    title: "Billing · KAIN",
    lastmessageat: RETIRED,
    groupingid: null,
    position: null,
    retiredat,
    role,
  });

  it("a member does not see a retired room", async () => {
    fake.state.selects.push([row("member", RETIRED)]);
    expect(await listMyChats("member-user")).toEqual([]);
  });

  it("the owner still sees it", async () => {
    fake.state.selects.push([row("owner", RETIRED)], [{ cid: CONV, n: 2 }]);
    const chats = await listMyChats("owner-user");
    expect(chats.map((c) => c.conversationid)).toEqual([CONV]);
  });

  it("an active room is listed for a member as before", async () => {
    fake.state.selects.push([row("member", null)], [{ cid: CONV, n: 2 }]);
    expect((await listMyChats("member-user")).map((c) => c.conversationid)).toEqual([CONV]);
  });
});
// [SCOPE 093 / T006] END
