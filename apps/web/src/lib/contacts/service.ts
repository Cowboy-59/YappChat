import { and, desc, eq, gt, ilike, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { users } from "../db/auth-schema";
import { contactinvites, contacts, type ContactRow } from "../db/contacts-schema";
import { channels, conversationmembers, conversations, messages } from "../db/engine-schema";
import { addConversationMember, createConversation, postSystemMessage, registerChannel } from "../engine/service";
import { resolveAvatarUrl } from "../account/avatar-resolve";
import { generateToken, hashToken } from "../auth/crypto";
import { sendEmail } from "../auth/mailer";
import { writeAudit } from "../auth/audit";
import { publishEvent } from "../ws/broker";
import { scopes, WSEventType } from "../ws/events";
import { getSiteUrl } from "../site";
import { EngineError } from "../engine/errors";
import { isUniqueViolation } from "../db/errors";
import { guardContactFloodOrThrow } from "./flood";

/**
 * Contacts (the "Individuals" context) + direct/group chats.
 *
 * A contact request is delivered AS A PRIVATE MESSAGE: it opens a 1:1
 * conversation and posts a "wants to connect" system message; accepting flips the
 * contact to `accepted` and unlocks normal DM messaging (enforced in the engine's
 * send path). Group DMs require all members to be accepted contacts of the creator.
 *
 * Spec 018 delta §2/§3/§5 (2026-07-01): rows are IMMUTABLE request events; a row
 * moves `pending → (accepted|declined)` exactly once. "Connected" is derived from
 * an `accepted` row existing (either direction) — never a single mutable cell. The
 * canonical `usera`/`userb` pair key + a partial unique index enforce at-most-one
 * active (`pending`/`accepted`) row per unordered pair; `declined` rows are 24h
 * purgeable history. Re-request after decline is immediate and plain; an opposite-
 * direction pending request auto-accepts. Contact requests pass a flood guard.
 */

const DIRECT_PLATFORM = "yappchat-internal";
/** Author id for the contact system notices ("wants to connect" / "now connected"). */
const CONTACT_SYSTEM_AUTHOR = "yappchat-contact";
const INVITE_TTL_MS = 7 * 24 * 3_600_000;
/** Declined rows are retained as short-term history, then purgeable (privacy control). */
const DECLINED_RETENTION_MS = 24 * 3_600_000;

export type UserLite = { id: string; displayname: string; email: string };
type Db = NonNullable<ReturnType<typeof getDb>>;

/** Canonical unordered-pair key: usera = LEAST, userb = GREATEST. Direction-agnostic. */
export function pairKey(a: string, b: string): { usera: string; userb: string } {
  return a < b ? { usera: a, userb: b } : { usera: b, userb: a };
}

/** One shared backing channel for all direct/group conversations (get-or-create). */
async function getDirectChannel(): Promise<string> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [existing] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.platformid, DIRECT_PLATFORM), eq(channels.name, "direct")))
    .limit(1);
  if (existing) return existing.id;
  const ch = await registerChannel({ platformid: DIRECT_PLATFORM, name: "direct" });
  return ch.id;
}

/** Search users by name/email (excluding self) for the contact picker. */
export async function searchUsers(q: string, selfId: string): Promise<UserLite[]> {
  const db = getDb();
  if (!db || q.trim().length < 2) return [];
  const like = `%${q.trim()}%`;
  const rows = await db
    .select({ id: users.id, displayname: users.displayname, email: users.email })
    .from(users)
    .where(and(ne(users.id, selfId), or(ilike(users.displayname, like), ilike(users.email, like))))
    .limit(10);
  return rows;
}

/** Lazy purge: drop declined history rows for a pair older than the retention window. */
async function purgeStaleDeclined(db: Db, usera: string, userb: string): Promise<void> {
  const cutoff = new Date(Date.now() - DECLINED_RETENTION_MS);
  await db
    .delete(contacts)
    .where(
      and(
        eq(contacts.usera, usera),
        eq(contacts.userb, userb),
        eq(contacts.status, "declined"),
        lt(contacts.respondedat, cutoff),
      ),
    );
}

/** The single ACTIVE (pending/accepted) row between two users, or undefined. */
async function activeRowBetween(db: Db, a: string, b: string): Promise<ContactRow | undefined> {
  const { usera, userb } = pairKey(a, b);
  const [row] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.usera, usera),
        eq(contacts.userb, userb),
        or(eq(contacts.status, "pending"), eq(contacts.status, "accepted")),
      ),
    )
    .limit(1);
  return row;
}

/** Whether two users are accepted (mutual) contacts — the DM gate (derived). */
export async function areContacts(a: string, b: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const { usera, userb } = pairKey(a, b);
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.usera, usera), eq(contacts.userb, userb), eq(contacts.status, "accepted")))
    .limit(1);
  return Boolean(row);
}

async function displayName(db: Db, userid: string): Promise<string> {
  const [u] = await db.select({ d: users.displayname, e: users.email }).from(users).where(eq(users.id, userid)).limit(1);
  return u?.d?.trim() || u?.e?.split("@")[0] || "Someone";
}

/**
 * Get-or-create the pair's 1:1 conversation (both as members). Reuses the pair's
 * existing conversation across re-requests (delta §2 OQ-D) — a re-request lands in
 * the same thread; declined rows post no visible system message.
 */
async function getOrCreateDirectConversation(a: string, b: string): Promise<string> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const { usera, userb } = pairKey(a, b);
  const [withConv] = await db
    .select({ conversationid: contacts.conversationid })
    .from(contacts)
    .where(and(eq(contacts.usera, usera), eq(contacts.userb, userb), isNotNull(contacts.conversationid)))
    .orderBy(desc(contacts.createdat))
    .limit(1);
  if (withConv?.conversationid) return withConv.conversationid;
  const channelid = await getDirectChannel();
  const conv = await createConversation(channelid, { kind: "person", title: "" });
  await addConversationMember({ conversationid: conv.id, userid: a, role: "member" });
  await addConversationMember({ conversationid: conv.id, userid: b, role: "member" });
  return conv.id;
}

async function postWantsToConnect(db: Db, conversationid: string, requesterid: string): Promise<void> {
  await postSystemMessage({
    conversationid,
    authorid: CONTACT_SYSTEM_AUTHOR,
    authorname: "Contacts",
    content: `${await displayName(db, requesterid)} wants to connect and share contact info.`,
  });
}

async function postConnected(db: Db, conversationid: string, accepterId: string): Promise<void> {
  await postSystemMessage({
    conversationid,
    authorid: CONTACT_SYSTEM_AUTHOR,
    authorname: "Contacts",
    content: `${await displayName(db, accepterId)} accepted — you're now connected.`,
  });
}

/**
 * Request a contact (from search OR from clicking someone in a community). Opens
 * the 1:1 conversation and posts the connect request as a private message.
 * Idempotent on an existing active row; an opposite-direction pending request
 * auto-accepts (mutual intent). Gated by the contact-request flood guard.
 */
export async function requestContact(
  requesterid: string,
  addresseeid: string,
): Promise<{ contactid: string; conversationid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  if (requesterid === addresseeid) throw new EngineError("cannot_self_contact", 400);

  // Flood gate runs FIRST — a frozen sender is stopped at the door and does not
  // further increment the window (delta §5).
  await guardContactFloodOrThrow(requesterid);

  const { usera, userb } = pairKey(requesterid, addresseeid);
  await purgeStaleDeclined(db, usera, userb);

  const active = await activeRowBetween(db, requesterid, addresseeid);
  if (active) {
    if (active.status === "accepted") {
      // Already connected — no-op, return the connection + conversation.
      const conversationid = active.conversationid ?? (await getOrCreateDirectConversation(requesterid, addresseeid));
      return { contactid: active.id, conversationid };
    }
    // Active pending row exists.
    if (active.requesterid === requesterid) {
      // Same-direction duplicate — idempotent, no new row, no second message.
      const conversationid = active.conversationid ?? (await getOrCreateDirectConversation(requesterid, addresseeid));
      return { contactid: active.id, conversationid };
    }
    // Opposite-direction pending (the other user asked first) → auto-accept as
    // mutual intent (a legal addressee-initiated pending→accepted; index never trips).
    const conversationid = active.conversationid ?? (await getOrCreateDirectConversation(requesterid, addresseeid));
    await db
      .update(contacts)
      .set({ status: "accepted", respondedat: new Date(), conversationid })
      .where(and(eq(contacts.id, active.id), eq(contacts.status, "pending")));
    await postConnected(db, conversationid, requesterid);
    return { contactid: active.id, conversationid };
  }

  // No active row → new immutable pending request.
  const conversationid = await getOrCreateDirectConversation(requesterid, addresseeid);
  const contactid = uuidv7();
  try {
    await db.insert(contacts).values({ id: contactid, requesterid, addresseeid, status: "pending", conversationid, usera, userb });
  } catch (err) {
    // Lost a race to the partial-unique index — return the now-existing active row idempotently.
    if (isUniqueViolation(err)) {
      const now = await activeRowBetween(db, requesterid, addresseeid);
      if (now) return { contactid: now.id, conversationid: now.conversationid ?? conversationid };
    }
    throw err;
  }
  await postWantsToConnect(db, conversationid, requesterid);
  return { contactid, conversationid };
}

/** Accept or decline a contact request (only the addressee may respond; terminal). */
export async function respondToContact(contactid: string, userid: string, accept: boolean): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(contacts).where(eq(contacts.id, contactid)).limit(1);
  if (!row) throw new EngineError("contact_not_found", 404);
  if (row.addresseeid !== userid) throw new EngineError("forbidden", 403);
  if (row.status !== "pending") throw new EngineError("already_responded", 409);
  await db
    .update(contacts)
    .set({ status: accept ? "accepted" : "declined", respondedat: new Date() })
    .where(and(eq(contacts.id, contactid), eq(contacts.status, "pending")));
  if (accept && row.conversationid) {
    await postConnected(db, row.conversationid, userid);
  }
}

/** Accepted contacts of a user (the other party + the DM conversation). */
export async function listContacts(userid: string): Promise<Array<UserLite & { conversationid: string | null; avatarurl: string | null }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ requesterid: contacts.requesterid, addresseeid: contacts.addresseeid, conversationid: contacts.conversationid })
    .from(contacts)
    .where(and(eq(contacts.status, "accepted"), or(eq(contacts.requesterid, userid), eq(contacts.addresseeid, userid))));
  const out: Array<UserLite & { conversationid: string | null; avatarurl: string | null }> = [];
  for (const r of rows) {
    const otherId = r.requesterid === userid ? r.addresseeid : r.requesterid;
    const [u] = await db.select({ id: users.id, displayname: users.displayname, email: users.email, avatarurl: users.avatarurl }).from(users).where(eq(users.id, otherId)).limit(1);
    if (u) out.push({ id: u.id, displayname: u.displayname, email: u.email, avatarurl: await resolveAvatarUrl(u.avatarurl), conversationid: r.conversationid });
  }
  return out;
}

/** Pending requests addressed TO this user (to accept/decline). */
export async function listIncomingRequests(userid: string): Promise<Array<{ contactid: string; conversationid: string | null; from: UserLite }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: contacts.id, requesterid: contacts.requesterid, conversationid: contacts.conversationid })
    .from(contacts)
    .where(and(eq(contacts.status, "pending"), eq(contacts.addresseeid, userid)));
  const out: Array<{ contactid: string; conversationid: string | null; from: UserLite }> = [];
  for (const r of rows) {
    const [u] = await db.select({ id: users.id, displayname: users.displayname, email: users.email }).from(users).where(eq(users.id, r.requesterid)).limit(1);
    if (u) out.push({ contactid: r.id, conversationid: r.conversationid, from: u });
  }
  return out;
}

/**
 * The caller's OUTGOING pending connections (FR-008): requests they sent that are
 * still awaiting a response, plus outstanding (unconsumed, unexpired) email invites.
 * Rendered in the Chats "Pending" section; each entry is withdrawable/cancellable.
 */
export type OutgoingPending =
  | { kind: "request"; contactid: string; conversationid: string | null; to: UserLite }
  | { kind: "invite"; inviteid: string; email: string };

export async function listOutgoing(userid: string): Promise<OutgoingPending[]> {
  const db = getDb();
  if (!db) return [];
  const out: OutgoingPending[] = [];
  // Requests I sent that are still pending (awaiting the addressee's accept/decline).
  const reqs = await db
    .select({ id: contacts.id, addresseeid: contacts.addresseeid, conversationid: contacts.conversationid })
    .from(contacts)
    .where(and(eq(contacts.status, "pending"), eq(contacts.requesterid, userid)));
  for (const r of reqs) {
    const [u] = await db.select({ id: users.id, displayname: users.displayname, email: users.email }).from(users).where(eq(users.id, r.addresseeid)).limit(1);
    if (u) out.push({ kind: "request", contactid: r.id, conversationid: r.conversationid, to: u });
  }
  // Email invites to non-users, not yet consumed and not expired.
  const invs = await db
    .select({ id: contactinvites.id, email: contactinvites.email })
    .from(contactinvites)
    .where(and(eq(contactinvites.inviterid, userid), isNull(contactinvites.consumedat), gt(contactinvites.expiresat, new Date())));
  for (const iv of invs) out.push({ kind: "invite", inviteid: iv.id, email: iv.email });
  return out;
}

/**
 * Withdraw the caller's own still-pending outgoing request (FR-008). Requester-only,
 * `pending`-only — a responded (`accepted`/`declined`) row is terminal (FR-018-2.1).
 * Retracts BOTH sides: deletes the pending row AND the contact system message(s) from
 * the pair conversation, so the recipient's inbox no longer offers Accept/Decline.
 */
export async function withdrawOutgoingRequest(userid: string, contactid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(contacts).where(eq(contacts.id, contactid)).limit(1);
  if (!row) throw new EngineError("contact_not_found", 404);
  if (row.requesterid !== userid) throw new EngineError("forbidden", 403);
  if (row.status !== "pending") throw new EngineError("already_responded", 409);
  if (row.conversationid) {
    await db
      .delete(messages)
      .where(and(eq(messages.conversationid, row.conversationid), eq(messages.authorid, CONTACT_SYSTEM_AUTHOR)));
  }
  await db.delete(contacts).where(and(eq(contacts.id, contactid), eq(contacts.status, "pending")));
}

/** Cancel the caller's own unconsumed email invite (FR-008); a consumed invite is already a contact. */
export async function cancelInvite(userid: string, inviteid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [inv] = await db.select().from(contactinvites).where(eq(contactinvites.id, inviteid)).limit(1);
  if (!inv) throw new EngineError("invite_not_found", 404);
  if (inv.inviterid !== userid) throw new EngineError("forbidden", 403);
  if (inv.consumedat) throw new EngineError("already_used", 409);
  await db.delete(contactinvites).where(and(eq(contactinvites.id, inviteid), isNull(contactinvites.consumedat)));
}

/** Invite a non-user by email to join + connect (or request directly if they exist). */
export async function inviteContactByEmail(inviterid: string, email: string): Promise<{ mode: "requested" | "invited" }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const norm = email.trim().toLowerCase();
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, norm)).limit(1);
  if (u) {
    // Existing user — delegate; the flood guard is counted once inside requestContact.
    await requestContact(inviterid, u.id);
    return { mode: "requested" };
  }
  // New-user invite — count this outbound attempt once against the flood guard.
  await guardContactFloodOrThrow(inviterid);
  const token = generateToken();
  await db.insert(contactinvites).values({
    id: uuidv7(),
    inviterid,
    email: norm,
    tokenhash: hashToken(token),
    expiresat: new Date(Date.now() + INVITE_TTL_MS),
  });
  await sendEmail({
    to: norm,
    subject: `${await displayName(db, inviterid)} wants to connect on YappChat`,
    body: "You've been invited to connect. Sign in (or create an account with this email) and open the link below — you'll be added as a contact.",
    actionUrl: `${getSiteUrl()}/invite/contact/${token}`,
  });
  return { mode: "invited" };
}

/** Create an ad-hoc group chat — all members must be accepted contacts of the creator. */
/**
 * Create a room (kind `group`) owned by the creator, with an optional title and
 * any number of accepted-contact members — INCLUDING zero (a **solo room**, e.g. a
 * spec 090 project room to be bound to remote management later). Members must be
 * accepted contacts of the creator; validation is atomic (all-or-nothing).
 */
export async function createRoom(
  creatorid: string,
  memberIds: string[],
  opts?: { title?: string },
): Promise<{ conversationid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const ids = [...new Set(memberIds.filter((id) => id && id !== creatorid))];
  const channelid = await getDirectChannel();
  const title = opts?.title?.trim() ?? "";

  return db.transaction(async (tx) => {
    for (const id of ids) {
      const { usera, userb } = pairKey(creatorid, id);
      const [acc] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.usera, usera), eq(contacts.userb, userb), eq(contacts.status, "accepted")))
        .limit(1);
      if (!acc) throw new EngineError("not_a_contact", 403, "you can only add accepted contacts");
    }
    const conversationid = uuidv7();
    await tx.insert(conversations).values({ id: conversationid, channelid, title, kind: "group" });
    await tx.insert(conversationmembers).values({ id: uuidv7(), conversationid, userid: creatorid, role: "member" });
    for (const id of ids) {
      await tx.insert(conversationmembers).values({ id: uuidv7(), conversationid, userid: id, role: "member" });
    }
    return { conversationid };
  });
}

export async function createGroupChat(creatorid: string, memberIds: string[]): Promise<{ conversationid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const ids = [...new Set(memberIds.filter((id) => id && id !== creatorid))];
  if (ids.length === 0) throw new EngineError("no_members", 400);
  const channelid = await getDirectChannel();

  // Atomic validate-then-add: either all members are accepted contacts and added,
  // or nothing persists (no partial group). (delta §9 — row-lock/serializable
  // TOCTOU hardening lands with block/unfriend §4, which makes revocation possible.)
  return db.transaction(async (tx) => {
    for (const id of ids) {
      const { usera, userb } = pairKey(creatorid, id);
      const [acc] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.usera, usera), eq(contacts.userb, userb), eq(contacts.status, "accepted")))
        .limit(1);
      if (!acc) throw new EngineError("not_a_contact", 403, "you can only add accepted contacts");
    }
    const conversationid = uuidv7();
    await tx.insert(conversations).values({ id: conversationid, channelid, title: "", kind: "group" });
    await tx.insert(conversationmembers).values({ id: uuidv7(), conversationid, userid: creatorid, role: "member" });
    for (const id of ids) {
      await tx.insert(conversationmembers).values({ id: uuidv7(), conversationid, userid: id, role: "member" });
    }
    return { conversationid };
  });
}

export type InviteAcceptReason = "not_found" | "expired" | "self_invite" | "email_unverified" | "email_mismatch" | "already_used";

/**
 * Consume an email contact-invite (after the invitee signs up) → accepted contact.
 * Hardened (delta §3): email-bound + verified-email-required + consume-first atomic.
 */
export async function acceptContactInvite(
  token: string,
  user: { id: string; email: string; emailverified: boolean },
): Promise<{ ok: boolean; reason?: InviteAcceptReason }> {
  const db = getDb();
  if (!db) return { ok: false, reason: "not_found" };
  const [inv] = await db.select().from(contactinvites).where(eq(contactinvites.tokenhash, hashToken(token))).limit(1);
  if (!inv) return { ok: false, reason: "not_found" };
  if (inv.expiresat < new Date()) return { ok: false, reason: "expired" };
  if (inv.inviterid === user.id) return { ok: false, reason: "self_invite" };
  // Email-binding requires a VERIFIED account email, else the bind is defeatable by
  // claiming any address at signup (finding #22).
  if (!user.emailverified) return { ok: false, reason: "email_unverified" };
  if (inv.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    await writeAudit({ eventtype: "contact_invite_rejected", userid: user.id, payload: { invite: inv.id, reason: "email_mismatch" } });
    return { ok: false, reason: "email_mismatch" };
  }
  // Consume-first atomic claim: only the winner (exactly one row affected) proceeds.
  const claimed = await db
    .update(contactinvites)
    .set({ consumedat: new Date() })
    .where(and(eq(contactinvites.id, inv.id), isNull(contactinvites.consumedat)))
    .returning({ id: contactinvites.id });
  if (claimed.length === 0) return { ok: false, reason: "already_used" };

  const conversationid = await getOrCreateDirectConversation(inv.inviterid, user.id);
  await upsertAcceptedContact(db, inv.inviterid, user.id, conversationid);
  await notifyInviterOfAccept(inv.inviterid, user.id, conversationid);
  return { ok: true };
}

/**
 * FR-025 — notify an inviter that their invite/request was accepted. Live via the
 * inviter's `user:{id}` WS scope (sidebar refreshes) + a durable system line in the
 * shared DM (visible whenever they open the chat, even if they were offline).
 */
async function notifyInviterOfAccept(inviterid: string, accepterId: string, conversationid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const accepterName = await displayName(db, accepterId);
  await postSystemMessage({
    conversationid,
    authorid: CONTACT_SYSTEM_AUTHOR,
    authorname: accepterName,
    content: `${accepterName} accepted your invitation — you're now connected.`,
  }).catch(() => {});
  await publishEvent({
    type: WSEventType.ContactAccepted,
    scope: scopes.user(inviterid),
    payload: { conversationid, userid: accepterId, name: accepterName },
  }).catch(() => {});
}

/**
 * FR-024 — auto-accept any pending email invite whose address matches this now-
 * verified user, creating the contact + DM and notifying each inviter. Called at
 * every point the user's email becomes verified (email-verify link, SSO provision).
 * Idempotent: the consume-first claim means the link-click path can't double-accept.
 * Returns the number of invites accepted.
 */
export async function autoAcceptContactInvitesForUser(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [u] = await db
    .select({ email: users.email, verified: users.emailverifiedat })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u || !u.verified) return 0; // guard: only for verified emails (matches link-accept)

  const pending = await db
    .select()
    .from(contactinvites)
    .where(and(ilike(contactinvites.email, u.email), isNull(contactinvites.consumedat), gt(contactinvites.expiresat, new Date())));

  let accepted = 0;
  for (const inv of pending) {
    if (inv.inviterid === userId) continue; // never self-connect
    // Consume-first atomic claim: only the winner proceeds (races the link path).
    const claimed = await db
      .update(contactinvites)
      .set({ consumedat: new Date() })
      .where(and(eq(contactinvites.id, inv.id), isNull(contactinvites.consumedat)))
      .returning({ id: contactinvites.id });
    if (claimed.length === 0) continue;

    const conversationid = await getOrCreateDirectConversation(inv.inviterid, userId);
    await upsertAcceptedContact(db, inv.inviterid, userId, conversationid);
    await notifyInviterOfAccept(inv.inviterid, userId, conversationid);
    accepted++;
  }
  return accepted;
}

/**
 * Winner-only contact write for invite accept (precise per delta §2/§3, finding #4):
 * accepted row → no-op; active pending row (either direction) → transition to
 * accepted; only declined/none → insert a NEW accepted row (never resurrect a declined row).
 */
async function upsertAcceptedContact(db: Db, inviterid: string, accepterId: string, conversationid: string): Promise<void> {
  const active = await activeRowBetween(db, inviterid, accepterId);
  if (active?.status === "accepted") {
    if (!active.conversationid) {
      await db.update(contacts).set({ conversationid }).where(eq(contacts.id, active.id));
    }
    return;
  }
  if (active) {
    // Active pending (either direction) → legal pending→accepted transition.
    await db
      .update(contacts)
      .set({ status: "accepted", respondedat: new Date(), conversationid: active.conversationid ?? conversationid })
      .where(and(eq(contacts.id, active.id), eq(contacts.status, "pending")));
    return;
  }
  const { usera, userb } = pairKey(inviterid, accepterId);
  try {
    await db.insert(contacts).values({
      id: uuidv7(),
      requesterid: inviterid,
      addresseeid: accepterId,
      status: "accepted",
      conversationid,
      usera,
      userb,
      respondedat: new Date(),
    });
  } catch (err) {
    // Raced another active insert — upgrade whatever active row now exists.
    if (isUniqueViolation(err)) {
      const now = await activeRowBetween(db, inviterid, accepterId);
      if (now && now.status !== "accepted") {
        await db.update(contacts).set({ status: "accepted", respondedat: new Date() }).where(and(eq(contacts.id, now.id), eq(contacts.status, "pending")));
      }
      return;
    }
    throw err;
  }
}

/**
 * List the caller's DM/group conversations (the Chats inbox), newest-active first,
 * each with a resolved display `name` (the other member for a 1:1; the title or a
 * member summary for a group) so the UI can show a real chat list.
 */
export async function listMyChats(
  userid: string,
): Promise<Array<{ conversationid: string; kind: string; title: string; name: string; groupingid: string | null; solo: boolean }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      title: conversations.title,
      lastmessageat: conversations.lastmessageat,
      // Spec 090 — the caller's per-user grouping placement for this room.
      groupingid: conversationmembers.groupingid,
      position: conversationmembers.position,
    })
    .from(conversationmembers)
    .innerJoin(conversations, eq(conversationmembers.conversationid, conversations.id))
    .where(eq(conversationmembers.userid, userid));
  const chats = rows
    .filter((r) => r.kind === "person" || r.kind === "group")
    .sort((a, b) => (b.lastmessageat?.getTime() ?? 0) - (a.lastmessageat?.getTime() ?? 0));

  // Member counts in one batched query → detect a "solo" room (spec 090 project /
  // remote-management room: a group with only the creator). No N+1.
  const memberCount = new Map<string, number>();
  if (chats.length > 0) {
    const counts = await db
      .select({ cid: conversationmembers.conversationid, n: sql<number>`count(*)::int` })
      .from(conversationmembers)
      .where(inArray(conversationmembers.conversationid, chats.map((c) => c.id)))
      .groupBy(conversationmembers.conversationid);
    for (const c of counts) memberCount.set(c.cid, c.n);
  }

  const out: Array<{ conversationid: string; kind: string; title: string; name: string; groupingid: string | null; solo: boolean }> = [];
  for (const r of chats) {
    let name = r.title?.trim() ?? "";
    if (r.kind === "person" || !name) {
      const others = await db
        .select({ d: users.displayname, e: users.email })
        .from(conversationmembers)
        .innerJoin(users, eq(conversationmembers.userid, users.id))
        .where(and(eq(conversationmembers.conversationid, r.id), ne(conversationmembers.userid, userid)));
      const names = others.map((o) => o.d?.trim() || o.e?.split("@")[0] || "").filter(Boolean);
      if (r.kind === "person") name = names[0] || "Direct message";
      else if (!name) name = names.slice(0, 3).join(", ") || "Group chat";
    }
    const solo = r.kind === "group" && (memberCount.get(r.id) ?? 1) === 1;
    out.push({ conversationid: r.id, kind: r.kind, title: r.title, name, groupingid: r.groupingid ?? null, solo });
  }
  return out;
}
