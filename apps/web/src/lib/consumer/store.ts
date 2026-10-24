/**
 * SPEC-093 — wxKanban company chat API: the persistence seam.
 *
 * The consumer services (accounts, groups, rooms) talk to the database only
 * through this interface, so the business rules (seat limits, owner protection,
 * idempotency, retired rooms) are unit-testable with an in-memory double and the
 * Drizzle implementation (drizzle-store.ts) stays a thin mapping.
 *
 * Every write runs inside `ConsumerStore.run`, one database transaction per call.
 * `lockOrg` / `lockRoom` take a row lock (SELECT ... FOR UPDATE) so two concurrent
 * calls cannot both pass a seat-limit or retired check.
 */

// [SCOPE 093 / T001] BEGIN — Consumer store record types
export type OrgRole = "owner" | "admin" | "member";

export type ConsumerOrg = {
  id: string;
  name: string;
  plantype: "individual" | "corporate";
  seatlimit: number | null;
};

export type ConsumerRoom = {
  id: string;
  kind: string;
  title: string;
  retiredat: Date | null;
};

export type ConsumerAuditRow = {
  userid: string | null;
  ip: string | null;
  payload: Record<string, unknown>;
};
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — Consumer store transaction interface
// MODIFIED-BY: [SCOPE 093 / T009, T010] — findUserByEmail (C1.0), getRoomRole (C1.8)
/** The operations available inside one consumer-call transaction. */
export interface ConsumerTx {
  userExists(userid: string): Promise<boolean>;
  /** SPEC-093 Amendment A (C1.0): the account for a normalized email, read only. */
  findUserByEmail(email: string): Promise<{ id: string; displayname: string } | null>;
  /** Users that exist among `ids` (used to refuse a room with an unknown member). */
  existingUserIds(ids: string[]): Promise<string[]>;

  insertOrg(org: ConsumerOrg): Promise<void>;
  /** Read the org and lock its row for the rest of the transaction. */
  lockOrg(orgid: string): Promise<ConsumerOrg | null>;
  updateOrgSeatlimit(orgid: string, seatlimit: number | null): Promise<void>;
  /** Members other than the owner — the seats a wxKanban plan pays for. */
  countNonOwnerMembers(orgid: string): Promise<number>;
  getOrgRole(orgid: string, userid: string): Promise<OrgRole | null>;
  insertOrgMember(orgid: string, userid: string, role: OrgRole): Promise<void>;
  updateOrgMemberRole(orgid: string, userid: string, role: OrgRole): Promise<void>;
  deleteOrgMember(orgid: string, userid: string): Promise<void>;

  /** The owner's first `projects` chat grouping, or null. */
  findProjectsGrouping(userid: string): Promise<string | null>;
  /** Create a `projects` grouping; returns null if the name is already taken. */
  insertProjectsGrouping(userid: string, name: string): Promise<string | null>;
  directChannelId(): Promise<string>;
  insertRoom(room: { id: string; channelid: string; title: string }): Promise<void>;
  /** Read the room and lock its row for the rest of the transaction. */
  lockRoom(conversationid: string): Promise<ConsumerRoom | null>;
  setRoomRetired(conversationid: string, at: Date): Promise<void>;
  isRoomMember(conversationid: string, userid: string): Promise<boolean>;
  /** SPEC-093 Amendment A (C1.8): the member's role in the room, or null when not a member. */
  getRoomRole(conversationid: string, userid: string): Promise<string | null>;
  insertRoomMember(input: {
    conversationid: string;
    userid: string;
    role: "owner" | "member";
    groupingid: string | null;
  }): Promise<void>;
  deleteRoomMember(conversationid: string, userid: string): Promise<void>;

  insertPasswordResetToken(input: { userid: string; tokenhash: string; expiresat: Date }): Promise<void>;
}
// [SCOPE 093 / T001] END

// [SCOPE 093 / T001] BEGIN — Consumer store entry point
export interface ConsumerStore {
  /** Run `fn` in one transaction; a thrown error rolls every write back. */
  run<T>(fn: (tx: ConsumerTx) => Promise<T>): Promise<T>;
  /** Append one authauditlog row. Best-effort: never throws. */
  writeAudit(row: ConsumerAuditRow): Promise<void>;
}
// [SCOPE 093 / T001] END
