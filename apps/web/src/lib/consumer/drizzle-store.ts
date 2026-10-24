import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { authauditlog, orgmemberships, orgs, passwordresettokens, users } from "../db/auth-schema";
import { channels, conversationmembers, conversations } from "../db/engine-schema";
import { chatgroupings } from "../db/groupings-schema";
import { anonymizeIp } from "../auth/crypto";
import { ConsumerError } from "./errors";
import type { ConsumerAuditRow, ConsumerOrg, ConsumerRoom, ConsumerStore, ConsumerTx, OrgRole } from "./store";

/**
 * SPEC-093 — the Drizzle (Postgres) implementation of the consumer store. Thin by
 * design: the rules live in accounts.ts / groups.ts / rooms.ts. Every call runs in
 * one transaction; lockOrg / lockRoom use SELECT ... FOR UPDATE so a seat-limit or
 * retired check cannot be raced. Inserts that could collide use ON CONFLICT DO
 * NOTHING, because a unique violation would abort the whole Postgres transaction.
 */

// [SCOPE 093 / T001] BEGIN — Drizzle handle types
type Db = NonNullable<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const DIRECT_PLATFORM = "yappchat-internal"; // matches lib/contacts/service.ts
const CONSUMER_AUDIT_EVENT = "consumer_api";
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — DrizzleConsumerTx
// MODIFIED-BY: [SCOPE 093 / T009, T010] — findUserByEmail (C1.0), getRoomRole (C1.8)
class DrizzleConsumerTx implements ConsumerTx {
  constructor(private readonly tx: Tx) {}

  async findUserByEmail(email: string): Promise<{ id: string; displayname: string } | null> {
    const [row] = await this.tx
      .select({ id: users.id, displayname: users.displayname })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ?? null;
  }

  async getRoomRole(conversationid: string, userid: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ role: conversationmembers.role })
      .from(conversationmembers)
      .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)))
      .limit(1);
    return row ? row.role : null;
  }

  async userExists(userid: string): Promise<boolean> {
    const [row] = await this.tx.select({ id: users.id }).from(users).where(eq(users.id, userid)).limit(1);
    return Boolean(row);
  }

  async existingUserIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.tx.select({ id: users.id }).from(users).where(inArray(users.id, ids));
    return rows.map((r) => r.id);
  }

  async insertOrg(org: ConsumerOrg): Promise<void> {
    await this.tx.insert(orgs).values({ id: org.id, name: org.name, plantype: org.plantype, seatlimit: org.seatlimit });
  }

  async lockOrg(orgid: string): Promise<ConsumerOrg | null> {
    const [row] = await this.tx
      .select({ id: orgs.id, name: orgs.name, plantype: orgs.plantype, seatlimit: orgs.seatlimit })
      .from(orgs)
      .where(eq(orgs.id, orgid))
      .limit(1)
      .for("update");
    return row ?? null;
  }

  async updateOrgSeatlimit(orgid: string, seatlimit: number | null): Promise<void> {
    await this.tx.update(orgs).set({ seatlimit }).where(eq(orgs.id, orgid));
  }

  async countNonOwnerMembers(orgid: string): Promise<number> {
    const [row] = await this.tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orgmemberships)
      .where(and(eq(orgmemberships.orgid, orgid), ne(orgmemberships.role, "owner")));
    return row?.n ?? 0;
  }

  async getOrgRole(orgid: string, userid: string): Promise<OrgRole | null> {
    const [row] = await this.tx
      .select({ role: orgmemberships.role })
      .from(orgmemberships)
      .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, userid)))
      .limit(1);
    return row?.role ?? null;
  }

  async insertOrgMember(orgid: string, userid: string, role: OrgRole): Promise<void> {
    await this.tx.insert(orgmemberships).values({ id: uuidv7(), orgid, userid, role }).onConflictDoNothing();
  }

  async updateOrgMemberRole(orgid: string, userid: string, role: OrgRole): Promise<void> {
    await this.tx
      .update(orgmemberships)
      .set({ role })
      .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, userid)));
  }

  async deleteOrgMember(orgid: string, userid: string): Promise<void> {
    await this.tx
      .delete(orgmemberships)
      .where(and(eq(orgmemberships.orgid, orgid), eq(orgmemberships.userid, userid)));
  }

  async findProjectsGrouping(userid: string): Promise<string | null> {
    const [row] = await this.tx
      .select({ id: chatgroupings.id })
      .from(chatgroupings)
      .where(and(eq(chatgroupings.userid, userid), eq(chatgroupings.type, "projects")))
      .orderBy(asc(chatgroupings.position), asc(chatgroupings.createdat))
      .limit(1);
    return row?.id ?? null;
  }

  async insertProjectsGrouping(userid: string, name: string): Promise<string | null> {
    const rows = await this.tx
      .insert(chatgroupings)
      .values({ id: uuidv7(), userid, name, type: "projects", position: 0 })
      .onConflictDoNothing()
      .returning({ id: chatgroupings.id });
    return rows[0]?.id ?? null;
  }

  async directChannelId(): Promise<string> {
    const [row] = await this.tx
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.platformid, DIRECT_PLATFORM), eq(channels.name, "direct")))
      .limit(1);
    if (row) return row.id;
    // First room on a fresh deployment: register the shared internal channel the
    // same way contacts/service.ts does (its own connection; it is not per-room).
    const { registerChannel } = await import("../engine/service");
    const ch = await registerChannel({ platformid: DIRECT_PLATFORM, name: "direct" });
    if (!ch) throw new ConsumerError("direct_channel_unavailable", 503);
    return ch.id;
  }

  async insertRoom(room: { id: string; channelid: string; title: string }): Promise<void> {
    await this.tx.insert(conversations).values({ id: room.id, channelid: room.channelid, title: room.title, kind: "group" });
  }

  async lockRoom(conversationid: string): Promise<ConsumerRoom | null> {
    const [row] = await this.tx
      .select({
        id: conversations.id,
        kind: conversations.kind,
        title: conversations.title,
        retiredat: conversations.retiredat,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationid))
      .limit(1)
      .for("update");
    return row ?? null;
  }

  async setRoomRetired(conversationid: string, at: Date): Promise<void> {
    await this.tx.update(conversations).set({ retiredat: at }).where(eq(conversations.id, conversationid));
  }

  async isRoomMember(conversationid: string, userid: string): Promise<boolean> {
    const [row] = await this.tx
      .select({ id: conversationmembers.id })
      .from(conversationmembers)
      .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)))
      .limit(1);
    return Boolean(row);
  }

  async insertRoomMember(input: {
    conversationid: string;
    userid: string;
    role: "owner" | "member";
    groupingid: string | null;
  }): Promise<void> {
    await this.tx
      .insert(conversationmembers)
      .values({
        id: uuidv7(),
        conversationid: input.conversationid,
        userid: input.userid,
        role: input.role,
        groupingid: input.groupingid,
      })
      .onConflictDoNothing();
  }

  async deleteRoomMember(conversationid: string, userid: string): Promise<void> {
    await this.tx
      .delete(conversationmembers)
      .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)));
  }

  async insertPasswordResetToken(input: { userid: string; tokenhash: string; expiresat: Date }): Promise<void> {
    await this.tx.insert(passwordresettokens).values({
      id: uuidv7(),
      userid: input.userid,
      tokenhash: input.tokenhash,
      expiresat: input.expiresat,
    });
  }
}
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — DrizzleConsumerStore
export class DrizzleConsumerStore implements ConsumerStore {
  async run<T>(fn: (tx: ConsumerTx) => Promise<T>): Promise<T> {
    const db = getDb();
    if (!db) throw new ConsumerError("db_unavailable", 503);
    return db.transaction((tx) => fn(new DrizzleConsumerTx(tx)));
  }

  async writeAudit(row: ConsumerAuditRow): Promise<void> {
    const db = getDb();
    if (!db) return;
    try {
      await db.insert(authauditlog).values({
        id: uuidv7(),
        userid: row.userid,
        eventtype: CONSUMER_AUDIT_EVENT,
        ip: anonymizeIp(row.ip),
        payload: row.payload,
      });
    } catch {
      // Best-effort, like lib/auth/audit.ts: an audit failure never changes the
      // answer to wxKanban. The row is the record; there is no other logger here.
    }
  }
}
// [SCOPE 093 / T001] END
