import type { ConsumerDeps, OutboundEmail } from "../deps";
import type { ConsumerAuditRow, ConsumerOrg, ConsumerRoom, ConsumerStore, ConsumerTx, OrgRole } from "../store";

/**
 * SPEC-093 test double: an in-memory ConsumerStore with real rollback (a thrown
 * error inside `run` restores the state from before the call), plus recorders for
 * the welcome email and account provisioning. No database, no mail, no network.
 */

// [SCOPE 093 / T001] BEGIN — In-memory consumer store (tests only)
type State = {
  users: Map<string, { id: string; email: string }>;
  orgs: Map<string, ConsumerOrg>;
  orgmembers: Array<{ orgid: string; userid: string; role: OrgRole }>;
  groupings: Array<{ id: string; userid: string; name: string; type: string }>;
  rooms: Map<string, ConsumerRoom & { channelid: string }>;
  roommembers: Array<{ conversationid: string; userid: string; role: string; groupingid: string | null }>;
  resettokens: Array<{ userid: string; tokenhash: string; expiresat: Date }>;
};

function clone(s: State): State {
  return {
    users: new Map(s.users),
    orgs: new Map([...s.orgs].map(([k, v]) => [k, { ...v }])),
    orgmembers: s.orgmembers.map((m) => ({ ...m })),
    groupings: s.groupings.map((g) => ({ ...g })),
    rooms: new Map([...s.rooms].map(([k, v]) => [k, { ...v }])),
    roommembers: s.roommembers.map((m) => ({ ...m })),
    resettokens: s.resettokens.map((t) => ({ ...t })),
  };
}

let seq = 0;
export function testId(): string {
  seq += 1;
  return `00000000-0000-7000-8000-${seq.toString(16).padStart(12, "0")}`;
}

export class MemoryStore implements ConsumerStore {
  state: State = {
    users: new Map(),
    orgs: new Map(),
    orgmembers: [],
    groupings: [],
    rooms: new Map(),
    roommembers: [],
    resettokens: [],
  };
  audits: ConsumerAuditRow[] = [];
  readonly directChannel = testId();

  addUser(email: string): string {
    const id = testId();
    this.state.users.set(id, { id, email });
    return id;
  }

  async run<T>(fn: (tx: ConsumerTx) => Promise<T>): Promise<T> {
    const before = clone(this.state);
    try {
      return await fn(this.tx());
    } catch (err) {
      this.state = before;
      throw err;
    }
  }

  async writeAudit(row: ConsumerAuditRow): Promise<void> {
    this.audits.push(row);
  }

  private tx(): ConsumerTx {
    const s = () => this.state;
    const channel = this.directChannel;
    return {
      userExists: async (id) => s().users.has(id),
      findUserByEmail: async (email) => {
        const u = [...s().users.values()].find((x) => x.email === email);
        return u ? { id: u.id, displayname: u.email.split("@")[0] } : null;
      },
      existingUserIds: async (ids) => ids.filter((id) => s().users.has(id)),
      insertOrg: async (org) => {
        s().orgs.set(org.id, { ...org });
      },
      lockOrg: async (id) => {
        const o = s().orgs.get(id);
        return o ? { ...o } : null;
      },
      updateOrgSeatlimit: async (id, seatlimit) => {
        const o = s().orgs.get(id);
        if (o) o.seatlimit = seatlimit;
      },
      countNonOwnerMembers: async (orgid) =>
        s().orgmembers.filter((m) => m.orgid === orgid && m.role !== "owner").length,
      getOrgRole: async (orgid, userid) =>
        s().orgmembers.find((m) => m.orgid === orgid && m.userid === userid)?.role ?? null,
      insertOrgMember: async (orgid, userid, role) => {
        if (!s().orgmembers.some((m) => m.orgid === orgid && m.userid === userid)) {
          s().orgmembers.push({ orgid, userid, role });
        }
      },
      updateOrgMemberRole: async (orgid, userid, role) => {
        const m = s().orgmembers.find((x) => x.orgid === orgid && x.userid === userid);
        if (m) m.role = role;
      },
      deleteOrgMember: async (orgid, userid) => {
        s().orgmembers = s().orgmembers.filter((m) => !(m.orgid === orgid && m.userid === userid));
      },
      findProjectsGrouping: async (userid) =>
        s().groupings.find((g) => g.userid === userid && g.type === "projects")?.id ?? null,
      insertProjectsGrouping: async (userid, name) => {
        if (s().groupings.some((g) => g.userid === userid && g.name === name)) return null;
        const id = testId();
        s().groupings.push({ id, userid, name, type: "projects" });
        return id;
      },
      directChannelId: async () => channel,
      insertRoom: async (room) => {
        s().rooms.set(room.id, { id: room.id, kind: "group", title: room.title, retiredat: null, channelid: room.channelid });
      },
      lockRoom: async (id) => {
        const r = s().rooms.get(id);
        return r ? { id: r.id, kind: r.kind, title: r.title, retiredat: r.retiredat } : null;
      },
      setRoomRetired: async (id, at) => {
        const r = s().rooms.get(id);
        if (r) r.retiredat = at;
      },
      isRoomMember: async (cid, userid) => s().roommembers.some((m) => m.conversationid === cid && m.userid === userid),
      getRoomRole: async (cid, userid) =>
        s().roommembers.find((m) => m.conversationid === cid && m.userid === userid)?.role ?? null,
      insertRoomMember: async (input) => {
        if (!s().roommembers.some((m) => m.conversationid === input.conversationid && m.userid === input.userid)) {
          s().roommembers.push({ ...input });
        }
      },
      deleteRoomMember: async (cid, userid) => {
        s().roommembers = s().roommembers.filter((m) => !(m.conversationid === cid && m.userid === userid));
      },
      insertPasswordResetToken: async (input) => {
        s().resettokens.push({ ...input });
      },
    };
  }
}

export type TestDeps = ConsumerDeps & { store: MemoryStore; emails: OutboundEmail[] };

/** Deps over a MemoryStore; provisioning mirrors provisionOrLookupUserByEmail. */
export function makeTestDeps(now = new Date("2026-10-24T12:00:00.000Z")): TestDeps {
  const store = new MemoryStore();
  const emails: OutboundEmail[] = [];
  let tokenSeq = 0;
  return {
    store,
    emails,
    provisionUser: async ({ email }) => {
      const existing = [...store.state.users.values()].find((u) => u.email === email);
      if (existing) return { userid: existing.id, created: false };
      return { userid: store.addUser(email), created: true };
    },
    sendEmail: async (email) => {
      emails.push(email);
    },
    newToken: () => {
      tokenSeq += 1;
      return { token: `tok${tokenSeq}`, tokenhash: `hash${tokenSeq}` };
    },
    siteUrl: () => "https://chat.test",
    now: () => now,
    newId: () => testId(),
  };
}
// [SCOPE 093 / T001] END
