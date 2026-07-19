import { and, asc, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { users } from "../db/auth-schema";
import { contacts } from "../db/contacts-schema";
import {
  channels,
  conversationmembers,
  conversations,
  messageauditlog,
  messagedeliveries,
  messages,
  type ChannelRow,
  type ConversationMemberRow,
  type ConversationRow,
  type MessageRow,
} from "../db/engine-schema";
import { publishEvent } from "../ws/broker";
import { presignAttachments, type Attachment } from "../storage/s3";
import { resolveAvatarUrl } from "../account/avatar-resolve";
import { scopes, WSEventType } from "../ws/events";
import { EngineError } from "./errors";
import { sendViaPlugin, startAccount } from "./gateway";
import type { NormalizedMessage } from "./types";

/**
 * Spec 001 T2 — engine send/receive API the rest of YappChatt calls.
 * Inbound ack/nack + (channelid, platformmessageid) dedup; outbound persists a
 * messagedeliveries row from the plugin receipt; both publish over the spec 003
 * WS engine on the channel scope.
 */

function normalize(
  m: MessageRow,
  authorname: string | null = null,
  media: Attachment[] = [],
  authoravatar: string | null = null,
): NormalizedMessage {
  return {
    id: m.id,
    channelid: m.channelid,
    conversationid: m.conversationid,
    authorid: m.authorid,
    authorname,
    authoravatar,
    media,
    content: m.content,
    messagetype: m.messagetype,
    direction: m.direction,
    ackstate: m.ackstate,
    createdat: m.createdat.toISOString(),
    deletedat: m.deletedat ? m.deletedat.toISOString() : null,
    deletedby: m.deletedby ?? null,
  };
}

// authorid is text and may hold non-user ids (external/system authors); only
// uuid-shaped ids can be compared against users.id (uuid) without a cast error.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Display label for an author: account name (spec 011), else the email local-part. */
function authorLabelFrom(displayname: string | null, email: string | null): string | null {
  const name = displayname?.trim();
  if (name) return name;
  const local = email?.split("@")[0]?.trim();
  return local || null;
}

/** Resolve a single author's display label (for the WS publish path). */
async function resolveAuthorName(authorid: string): Promise<string | null> {
  const db = getDb();
  if (!db || !UUID_RE.test(authorid)) return null;
  const [u] = await db
    .select({ displayname: users.displayname, email: users.email })
    .from(users)
    .where(eq(users.id, authorid))
    .limit(1);
  return u ? authorLabelFrom(u.displayname, u.email) : null;
}

// ── Channels ────────────────────────────────────────────────────────────────

export async function registerChannel(input: {
  platformid: string;
  name: string;
  config?: unknown;
}): Promise<ChannelRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const id = uuidv7();
  await db.insert(channels).values({
    id,
    platformid: input.platformid,
    name: input.name,
    config: (input.config as object) ?? null,
  });
  const [row] = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  // Bring the account online (sets status healthy for the internal plugin).
  try {
    await startAccount(row);
  } catch (err) {
    console.error("[engine] startAccount failed:", err);
  }
  const [fresh] = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  return fresh;
}

export async function listChannels(): Promise<ChannelRow[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(channels).orderBy(desc(channels.createdat));
}

async function loadChannel(id: string): Promise<ChannelRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  if (!row) throw new EngineError("channel_not_found", 404);
  return row;
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function createConversation(
  channelid: string,
  input: { title?: string; kind?: "channel" | "group" | "person" | "agent" | "space" | "support"; externalid?: string },
): Promise<ConversationRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await loadChannel(channelid);
  const id = uuidv7();
  await db.insert(conversations).values({
    id,
    channelid,
    title: input.title ?? "",
    kind: input.kind ?? "channel",
    externalid: input.externalid ?? null,
  });
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return row;
}

export async function listConversations(channelid: string): Promise<ConversationRow[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.channelid, channelid))
    .orderBy(desc(conversations.lastmessageat));
}

async function loadConversation(id: string): Promise<ConversationRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!row) throw new EngineError("conversation_not_found", 404);
  return row;
}

/**
 * Clear a conversation: hard-delete every message, optionally keeping one
 * (`exceptMessageId` — e.g. the last incoming/agent message). Members only.
 * messagedeliveries / messagetranslations cascade-delete with their message.
 */
export async function clearConversationMessages(
  conversationid: string,
  actorId: string,
  exceptMessageId?: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  if (!(await isConversationMember(conversationid, actorId))) throw new EngineError("forbidden", 403);
  const where = exceptMessageId
    ? and(eq(messages.conversationid, conversationid), ne(messages.id, exceptMessageId))
    : eq(messages.conversationid, conversationid);
  await db.delete(messages).where(where);
}

export async function listMessages(conversationid: string): Promise<NormalizedMessage[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationid, conversationid))
    .orderBy(asc(messages.createdat))
    .limit(200);

  // Resolve author labels in one pass. `messages.authorid` is text while
  // `users.id` is uuid, so a column join can't auto-cast — a parameterized
  // inArray lookup binds the ids and casts cleanly.
  const ids = [...new Set(rows.map((r) => r.authorid))].filter((id) => UUID_RE.test(id));
  const labels = new Map<string, string | null>();
  const avatars = new Map<string, string | null>();
  if (ids.length) {
    const us = await db
      .select({ id: users.id, displayname: users.displayname, email: users.email, avatarurl: users.avatarurl })
      .from(users)
      .where(inArray(users.id, ids));
    // Resolve each unique author's avatar once (presign), not per message.
    await Promise.all(
      us.map(async (u) => {
        labels.set(u.id, authorLabelFrom(u.displayname, u.email));
        avatars.set(u.id, await resolveAvatarUrl(u.avatarurl));
      }),
    );
  }
  return Promise.all(
    rows.map(async (m) =>
      normalize(m, labels.get(m.authorid) ?? null, await presignAttachments(m.mediaurl), avatars.get(m.authorid) ?? null),
    ),
  );
}

// ── Outbound send (FR-003) ───────────────────────────────────────────────────

export async function sendMessage(input: {
  conversationid: string;
  authorid: string;
  content: string;
  mediaurl?: string[];
}): Promise<NormalizedMessage> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const media = input.mediaurl?.filter(Boolean) ?? [];
  // A message must carry text and/or at least one attachment.
  if (!input.content.trim() && media.length === 0) throw new EngineError("content_required", 400);

  const conversation = await loadConversation(input.conversationid);
  const channel = await loadChannel(conversation.channelid);

  // DM gate: in a 1:1 (`person`) conversation, only accepted contacts may
  // exchange messages. The connect request itself is a system message
  // (postSystemMessage), so it bypasses this user-send path.
  if (conversation.kind === "person") {
    const members = await db
      .select({ userid: conversationmembers.userid })
      .from(conversationmembers)
      .where(eq(conversationmembers.conversationid, conversation.id));
    const other = members.map((m) => m.userid).find((uid) => uid !== input.authorid);
    if (other) {
      const [c] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.status, "accepted"),
            or(
              and(eq(contacts.requesterid, input.authorid), eq(contacts.addresseeid, other)),
              and(eq(contacts.requesterid, other), eq(contacts.addresseeid, input.authorid)),
            ),
          ),
        )
        .limit(1);
      if (!c) throw new EngineError("not_connected", 403, "connect first to send messages");
    }
  }

  const id = uuidv7();
  await db.insert(messages).values({
    id,
    channelid: channel.id,
    conversationid: conversation.id,
    authorid: input.authorid,
    content: input.content,
    mediaurl: media.length ? media : null,
    direction: "outbound",
    ackstate: "pending",
  });

  // Build the delivery and call the plugin.
  const deliveryId = uuidv7();
  try {
    const receipt = await sendViaPlugin({ channel, conversation, authorid: input.authorid, content: input.content });
    await db.insert(messagedeliveries).values({
      id: deliveryId,
      messageid: id,
      channelid: channel.id,
      ackstate: "acked",
      primaryplatformmessageid: receipt.primaryPlatformMessageId,
      sentat: receipt.sentAt,
    });
    await db
      .update(messages)
      .set({ ackstate: "acked", ackedat: new Date(), platformmessageid: receipt.primaryPlatformMessageId })
      .where(eq(messages.id, id));
  } catch (err) {
    await db.insert(messagedeliveries).values({
      id: deliveryId,
      messageid: id,
      channelid: channel.id,
      ackstate: "nacked",
      error: (err as Error).message,
    });
    await db.update(messages).set({ ackstate: "nacked" }).where(eq(messages.id, id));
    throw new EngineError("send_failed", 502, (err as Error).message);
  }

  await db.update(conversations).set({ lastmessageat: new Date() }).where(eq(conversations.id, conversation.id));

  const [row] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  const msg = normalize(row, await resolveAuthorName(row.authorid), await presignAttachments(row.mediaurl));
  await publishMessageEvent("message.outbound", channel.id, msg, conversation.kind);
  return msg;
}

/**
 * Post a system/bot message into a conversation WITHOUT the plugin gateway
 * round-trip (the author is internal — e.g. the spec 017 FR-019 space AI — and
 * isn't bridged anywhere). Persists an outbound message, bumps the conversation,
 * and publishes the WS event so live members see it. `authorname` is passed
 * through to the publish payload since a non-uuid author has no users row.
 */
export async function postSystemMessage(input: {
  conversationid: string;
  authorid: string;
  authorname?: string | null;
  content: string;
}): Promise<NormalizedMessage> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  if (!input.content.trim()) throw new EngineError("content_required", 400);
  const conversation = await loadConversation(input.conversationid);

  const id = uuidv7();
  await db.insert(messages).values({
    id,
    channelid: conversation.channelid,
    conversationid: conversation.id,
    authorid: input.authorid,
    content: input.content,
    direction: "outbound",
    ackstate: "acked",
    ackedat: new Date(),
  });
  await db.update(conversations).set({ lastmessageat: new Date() }).where(eq(conversations.id, conversation.id));

  const [row] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  const msg = normalize(row, input.authorname ?? null);
  await publishMessageEvent("message.outbound", conversation.channelid, msg, conversation.kind);
  return msg;
}

/**
 * Spec 001 T009 — publish a message event to BOTH the legacy `channel:{id}` scope
 * (kept so the current /messaging demo + ws-e2e keep working) and the canonical
 * per-conversation `conversation:{id}` scope (membership-checked subscribe) that
 * Communities (spec 017) and future contexts consume.
 */
async function publishMessageEvent(
  type: "message.inbound" | "message.outbound",
  channelid: string,
  msg: NormalizedMessage,
  conversationKind?: string,
): Promise<void> {
  // Membership-checked per-conversation scope — the ONLY delivery path for private
  // native conversations (person/group DMs, community spaces, support).
  if (msg.conversationid) {
    await publishEvent({ type, scope: scopes.conversation(msg.conversationid), payload: msg });
  }
  // SECURITY: the open `channel:` scope has NO per-user authz (server/ws.ts
  // authorizes any signed-in subscriber) and all internal DMs share ONE channel,
  // so mirroring a private conversation's message there would broadcast its
  // plaintext to every user. Restrict the channel scope to legacy bridged channels
  // (external platforms); private native kinds ride only the conversation scope.
  const isPrivateNative =
    conversationKind === "person" ||
    conversationKind === "group" ||
    conversationKind === "space" ||
    conversationKind === "support";
  if (!isPrivateNative) {
    await publishEvent({ type, scope: scopes.channel(channelid), payload: msg });
  }
  // In-app "message arrived" notifications: fan a lightweight notify to each DM
  // recipient's user scope (they aren't subscribed to the conversation app-wide).
  // Only for 1:1/group DMs (small membership) + real chat messages, never the
  // author. Fire-and-forget — must never block or fail the send.
  if ((conversationKind === "person" || conversationKind === "group") && msg.messagetype !== "status") {
    void fanoutMessageNotify(msg);
  }
}

/** Publish `message.notify` to every recipient's `user:{id}` scope (except author). */
async function fanoutMessageNotify(msg: NormalizedMessage): Promise<void> {
  const db = getDb();
  if (!db || !msg.conversationid) return;
  try {
    const members = await db
      .select({ userid: conversationmembers.userid })
      .from(conversationmembers)
      .where(eq(conversationmembers.conversationid, msg.conversationid));
    const preview = msg.content?.trim()
      ? msg.content.trim().slice(0, 120)
      : msg.media?.length
        ? "📎 Attachment"
        : "New message";
    const payload = {
      conversationid: msg.conversationid,
      authorid: msg.authorid,
      authorname: msg.authorname,
      authoravatar: msg.authoravatar,
      preview,
      route: `/chats?conv=${msg.conversationid}`,
      createdat: msg.createdat,
    };
    await Promise.all(
      members
        .filter((m) => m.userid !== msg.authorid)
        .map((m) => publishEvent({ type: WSEventType.MessageNotify, scope: scopes.user(m.userid), payload })),
    );
  } catch (err) {
    console.error("[engine] message notify fanout failed:", (err as Error).message);
  }
}

// ── Inbound ingestion (FR-002) ────────────────────────────────────────────────

export async function ingestInbound(
  channelid: string,
  input: { platformmessageid?: string; authorid: string; content: string; conversationid?: string },
): Promise<NormalizedMessage> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const channel = await loadChannel(channelid);

  // Dedup on (channelid, platformmessageid).
  if (input.platformmessageid) {
    const [existing] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.channelid, channelid), eq(messages.platformmessageid, input.platformmessageid)))
      .limit(1);
    if (existing) return normalize(existing, await resolveAuthorName(existing.authorid), await presignAttachments(existing.mediaurl));
  }

  const id = uuidv7();
  await db.insert(messages).values({
    id,
    channelid: channel.id,
    conversationid: input.conversationid ?? null,
    platformmessageid: input.platformmessageid ?? null,
    authorid: input.authorid,
    content: input.content,
    direction: "inbound",
    ackstate: "pending",
  });
  // ack() — advance pending -> acked.
  await db.update(messages).set({ ackstate: "acked", ackedat: new Date() }).where(eq(messages.id, id));

  if (input.conversationid) {
    await db.update(conversations).set({ lastmessageat: new Date() }).where(eq(conversations.id, input.conversationid));
  }

  const [row] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  const msg = normalize(row, await resolveAuthorName(row.authorid), await presignAttachments(row.mediaurl));
  await publishMessageEvent("message.inbound", channel.id, msg);
  return msg;
}

// ── Conversation membership (T009 shared core) ───────────────────────────────

/** Add a member to a conversation (idempotent on (conversationid, userid)). */
export async function addConversationMember(input: {
  conversationid: string;
  userid: string;
  role?: string;
}): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await db
    .insert(conversationmembers)
    .values({ id: uuidv7(), conversationid: input.conversationid, userid: input.userid, role: input.role ?? "member" })
    .onConflictDoNothing();
}

/** List the members of a conversation. */
export async function listConversationMembers(conversationid: string): Promise<ConversationMemberRow[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(conversationmembers).where(eq(conversationmembers.conversationid, conversationid));
}

/** Delete a conversation (cascades its messages + deliveries + members). */
export async function deleteConversation(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.delete(conversations).where(eq(conversations.id, id));
}

/** Delete a channel (cascades its conversations → messages). */
export async function deleteChannel(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.delete(channels).where(eq(channels.id, id));
}

/** Mark a conversation read for a user (advances their `lastreadat` to now). */
export async function markConversationRead(conversationid: string, userid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(conversationmembers)
    .set({ lastreadat: new Date() })
    .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)));
}

/**
 * Unread counts for a set of conversations the user belongs to: messages newer
 * than the member's `lastreadat` (or all, if never read) that they didn't author.
 * Returns a `{ conversationid: count }` map; conversations with no unread are
 * omitted. Used by the sidebar nav tree (spec 068 / FR-019 shell).
 */
export async function unreadByConversation(
  userid: string,
  conversationIds: string[],
): Promise<Record<string, number>> {
  const db = getDb();
  if (!db || conversationIds.length === 0) return {};
  const rows = await db
    .select({ conversationid: messages.conversationid, n: count() })
    .from(messages)
    .innerJoin(
      conversationmembers,
      and(eq(conversationmembers.conversationid, messages.conversationid), eq(conversationmembers.userid, userid)),
    )
    .where(
      and(
        inArray(messages.conversationid, conversationIds),
        ne(messages.authorid, userid),
        sql`${messages.createdat} > coalesce(${conversationmembers.lastreadat}, to_timestamp(0))`,
      ),
    )
    .groupBy(messages.conversationid);
  const out: Record<string, number> = {};
  for (const r of rows) if (r.conversationid) out[r.conversationid] = Number(r.n);
  return out;
}

/** Whether a user is a member of a conversation — the subscribe-authz predicate. */
export async function isConversationMember(conversationid: string, userid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: conversationmembers.id })
    .from(conversationmembers)
    .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)))
    .limit(1);
  return Boolean(row);
}

/** The caller's role in a conversation ('member' | 'admin' | 'owner'), or null if not a member. */
export async function conversationRole(conversationid: string, userid: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ role: conversationmembers.role })
    .from(conversationmembers)
    .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)))
    .limit(1);
  return row?.role ?? null;
}

/**
 * FR-015 — user-initiated soft-delete ("unsend for everyone"). Authorization:
 * the message author, OR an admin/owner member of the conversation. Clears the
 * payload, marks the tombstone, writes an immutable audit row, and broadcasts
 * `message.deleted` so every member's open chat updates live. Idempotent.
 */
export async function deleteMessage(input: { messageid: string; actorid: string }): Promise<NormalizedMessage> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const [row] = await db.select().from(messages).where(eq(messages.id, input.messageid)).limit(1);
  if (!row) throw new EngineError("message_not_found", 404);

  // Already a tombstone → no-op, return current state (idempotent delete).
  if (row.deletedat) return normalize(row);

  // Authz: author always; otherwise must be an admin/owner of the conversation.
  const isAuthor = row.authorid === input.actorid;
  if (!isAuthor) {
    const role = row.conversationid ? await conversationRole(row.conversationid, input.actorid) : null;
    if (role !== "admin" && role !== "owner") throw new EngineError("forbidden", 403);
  }

  const deletedat = new Date();
  const [updated] = await db
    .update(messages)
    .set({ deletedat, deletedby: input.actorid, content: null, encryptedpayload: null, mediaurl: [] })
    .where(eq(messages.id, input.messageid))
    .returning();

  await db.insert(messageauditlog).values({
    id: uuidv7(),
    messageid: row.id,
    conversationid: row.conversationid,
    actorid: input.actorid,
    action: "user-delete",
  });

  const tombstone = normalize(updated);
  // Delete-for-everyone: notify all members on the membership-checked scope.
  if (tombstone.conversationid) {
    await publishEvent({ type: "message.deleted", scope: scopes.conversation(tombstone.conversationid), payload: tombstone });
  }
  return tombstone;
}
