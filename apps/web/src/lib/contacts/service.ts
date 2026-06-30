import { and, eq, ilike, ne, or } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { users } from "../db/auth-schema";
import { contactinvites, contacts, type ContactRow } from "../db/contacts-schema";
import { channels, conversationmembers, conversations } from "../db/engine-schema";
import { addConversationMember, createConversation, postSystemMessage, registerChannel } from "../engine/service";
import { generateToken, hashToken } from "../auth/crypto";
import { sendEmail } from "../auth/mailer";
import { getSiteUrl } from "../site";
import { EngineError } from "../engine/errors";

/**
 * Contacts (the "Individuals" context) + direct/group chats.
 *
 * A contact request is delivered AS A PRIVATE MESSAGE: it opens a 1:1
 * conversation and posts a "wants to connect" system message; accepting flips the
 * contact to `accepted` and unlocks normal DM messaging (enforced in the engine's
 * send path). Group DMs require all members to be accepted contacts of the creator.
 */

const DIRECT_PLATFORM = "yappchat-internal";
const INVITE_TTL_MS = 7 * 24 * 3_600_000;

export type UserLite = { id: string; displayname: string; email: string };

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

/** The accepted-contact row between two users (either direction), or undefined. */
async function contactBetween(db: NonNullable<ReturnType<typeof getDb>>, a: string, b: string): Promise<ContactRow | undefined> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(
      or(
        and(eq(contacts.requesterid, a), eq(contacts.addresseeid, b)),
        and(eq(contacts.requesterid, b), eq(contacts.addresseeid, a)),
      ),
    )
    .limit(1);
  return row;
}

/** Whether two users are accepted (mutual) contacts — the DM gate. */
export async function areContacts(a: string, b: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const row = await contactBetween(db, a, b);
  return row?.status === "accepted";
}

async function displayName(db: NonNullable<ReturnType<typeof getDb>>, userid: string): Promise<string> {
  const [u] = await db.select({ d: users.displayname, e: users.email }).from(users).where(eq(users.id, userid)).limit(1);
  return u?.d?.trim() || u?.e?.split("@")[0] || "Someone";
}

/** Get-or-create the 1:1 conversation between two users (both as members). */
async function getOrCreateDirectConversation(a: string, b: string): Promise<string> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const existing = await contactBetween(db, a, b);
  if (existing?.conversationid) return existing.conversationid;
  const channelid = await getDirectChannel();
  const conv = await createConversation(channelid, { kind: "person", title: "" });
  await addConversationMember({ conversationid: conv.id, userid: a, role: "member" });
  await addConversationMember({ conversationid: conv.id, userid: b, role: "member" });
  return conv.id;
}

/**
 * Request a contact (from search OR from clicking someone in a community). Opens
 * the 1:1 conversation and posts the connect request as a private message.
 */
export async function requestContact(requesterid: string, addresseeid: string): Promise<{ contactid: string; conversationid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  if (requesterid === addresseeid) throw new EngineError("cannot_self_contact", 400);

  const existing = await contactBetween(db, requesterid, addresseeid);
  if (existing?.status === "accepted") {
    return { contactid: existing.id, conversationid: existing.conversationid ?? (await getOrCreateDirectConversation(requesterid, addresseeid)) };
  }
  const conversationid = await getOrCreateDirectConversation(requesterid, addresseeid);

  let contactid: string;
  if (existing) {
    contactid = existing.id;
    await db.update(contacts).set({ conversationid }).where(eq(contacts.id, existing.id));
  } else {
    contactid = uuidv7();
    await db.insert(contacts).values({ id: contactid, requesterid, addresseeid, status: "pending", conversationid });
  }
  await postSystemMessage({
    conversationid,
    authorid: "yappchat-contact",
    authorname: "Contacts",
    content: `${await displayName(db, requesterid)} wants to connect and share contact info.`,
  });
  return { contactid, conversationid };
}

/** Accept or decline a contact request (only the addressee may respond). */
export async function respondToContact(contactid: string, userid: string, accept: boolean): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(contacts).where(eq(contacts.id, contactid)).limit(1);
  if (!row) throw new EngineError("contact_not_found", 404);
  if (row.addresseeid !== userid) throw new EngineError("forbidden", 403);
  await db
    .update(contacts)
    .set({ status: accept ? "accepted" : "declined", respondedat: new Date() })
    .where(eq(contacts.id, contactid));
  if (accept && row.conversationid) {
    await postSystemMessage({
      conversationid: row.conversationid,
      authorid: "yappchat-contact",
      authorname: "Contacts",
      content: `${await displayName(db, userid)} accepted — you're now connected.`,
    });
  }
}

/** Accepted contacts of a user (the other party + the DM conversation). */
export async function listContacts(userid: string): Promise<Array<UserLite & { conversationid: string | null }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ requesterid: contacts.requesterid, addresseeid: contacts.addresseeid, conversationid: contacts.conversationid })
    .from(contacts)
    .where(and(eq(contacts.status, "accepted"), or(eq(contacts.requesterid, userid), eq(contacts.addresseeid, userid))));
  const out: Array<UserLite & { conversationid: string | null }> = [];
  for (const r of rows) {
    const otherId = r.requesterid === userid ? r.addresseeid : r.requesterid;
    const [u] = await db.select({ id: users.id, displayname: users.displayname, email: users.email }).from(users).where(eq(users.id, otherId)).limit(1);
    if (u) out.push({ ...u, conversationid: r.conversationid });
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

/** Invite a non-user by email to join + connect (or request directly if they exist). */
export async function inviteContactByEmail(inviterid: string, email: string): Promise<{ mode: "requested" | "invited" }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const norm = email.trim().toLowerCase();
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, norm)).limit(1);
  if (u) {
    await requestContact(inviterid, u.id);
    return { mode: "requested" };
  }
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
    subject: `${await displayName(db, inviterid)} wants to connect on YappChatt`,
    body: "You've been invited to connect. Sign in (or create an account with this email) and open the link below — you'll be added as a contact.",
    actionUrl: `${getSiteUrl()}/invite/contact/${token}`,
  });
  return { mode: "invited" };
}

/** Create an ad-hoc group chat — all members must be accepted contacts of the creator. */
export async function createGroupChat(creatorid: string, memberIds: string[]): Promise<{ conversationid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const ids = [...new Set(memberIds.filter((id) => id && id !== creatorid))];
  if (ids.length === 0) throw new EngineError("no_members", 400);
  for (const id of ids) {
    if (!(await areContacts(creatorid, id))) throw new EngineError("not_a_contact", 403, "you can only add accepted contacts");
  }
  const channelid = await getDirectChannel();
  const conv = await createConversation(channelid, { kind: "group", title: "" });
  await addConversationMember({ conversationid: conv.id, userid: creatorid, role: "member" });
  for (const id of ids) await addConversationMember({ conversationid: conv.id, userid: id });
  return { conversationid: conv.id };
}

/** Consume an email contact-invite (after the invitee signs up) → accepted contact. */
export async function acceptContactInvite(token: string, userid: string): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  const [inv] = await db.select().from(contactinvites).where(eq(contactinvites.tokenhash, hashToken(token))).limit(1);
  if (!inv || inv.consumedat || inv.expiresat < new Date() || inv.inviterid === userid) return { ok: false };
  const conversationid = await getOrCreateDirectConversation(inv.inviterid, userid);
  const existing = await contactBetween(db, inv.inviterid, userid);
  if (existing) {
    await db.update(contacts).set({ status: "accepted", conversationid, respondedat: new Date() }).where(eq(contacts.id, existing.id));
  } else {
    await db.insert(contacts).values({ id: uuidv7(), requesterid: inv.inviterid, addresseeid: userid, status: "accepted", conversationid, respondedat: new Date() });
  }
  await db.update(contactinvites).set({ consumedat: new Date() }).where(eq(contactinvites.id, inv.id));
  return { ok: true };
}

/** List the caller's DM/group conversations (the Chats inbox). */
export async function listMyChats(userid: string): Promise<Array<{ conversationid: string; kind: string; title: string }>> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: conversations.id, kind: conversations.kind, title: conversations.title })
    .from(conversationmembers)
    .innerJoin(conversations, eq(conversationmembers.conversationid, conversations.id))
    .where(eq(conversationmembers.userid, userid));
  return rows.filter((r) => r.kind === "person" || r.kind === "group").map((r) => ({ conversationid: r.id, kind: r.kind, title: r.title }));
}
