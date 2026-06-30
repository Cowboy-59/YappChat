import { and, desc, eq, ne } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { orgmemberships, users } from "../db/auth-schema";
import { channels } from "../db/engine-schema";
import { supportsessions, type SupportSessionRow } from "../db/support-schema";
import { addConversationMember, createConversation, postSystemMessage, registerChannel } from "../engine/service";
import { EngineError } from "../engine/errors";
import { publishEvent } from "../ws/broker";
import { scopes, WSEventType } from "../ws/events";

/**
 * App Support Chatroom service — Phase 1 (in-app, logged-in requesters).
 *
 * A support session = a spec 001 conversation (kind `support`) under a per-org
 * support channel, with the requester + the org's support agents as members. We
 * reuse the engine wholesale (createConversation / addConversationMember /
 * postSystemMessage / publishEvent); the only support-specific state is the
 * `supportsessions` row. Routing is per-app (`appkey`) but org-scoped.
 */

const SUPPORT_PLATFORM = "yappchat-internal";
const SUPPORT_AUTHOR_ID = "yappchat-support";
const SUPPORT_AUTHOR_NAME = "Support";

/**
 * One backing channel per org (get-or-create). Conversations for every support
 * session in the org hang off it. The channel id is never sent to clients —
 * privacy rests on the membership-checked `conversation:{id}` scope, not the
 * legacy (open) `channel:{id}` scope.
 */
async function getOrCreateSupportChannel(orgid: string): Promise<string> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const name = `support:${orgid}`;
  const [existing] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.platformid, SUPPORT_PLATFORM), eq(channels.name, name)))
    .limit(1);
  if (existing) return existing.id;
  const ch = await registerChannel({ platformid: SUPPORT_PLATFORM, name });
  return ch.id;
}

/** The org's support agents — org members flagged `users.issupport`. */
async function listOrgSupportAgents(orgid: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: users.id })
    .from(orgmemberships)
    .innerJoin(users, eq(orgmemberships.userid, users.id))
    .where(and(eq(orgmemberships.orgid, orgid), eq(users.issupport, true)));
  return rows.map((r) => r.id);
}

export async function startSupportSession(input: {
  requesterid: string;
  orgid: string;
  appkey: string;
  subject?: string;
}): Promise<SupportSessionRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const channelid = await getOrCreateSupportChannel(input.orgid);
  const conversation = await createConversation(channelid, {
    title: `Support — ${input.appkey}`,
    kind: "support",
  });

  const id = uuidv7();
  await db.insert(supportsessions).values({
    id,
    conversationid: conversation.id,
    orgid: input.orgid,
    appkey: input.appkey,
    requesterid: input.requesterid,
  });

  // Members: the requester + every org support agent (so it lands in their list
  // and the membership-checked subscribe authorizes both sides immediately).
  await addConversationMember({ conversationid: conversation.id, userid: input.requesterid, role: "requester" });
  for (const agentid of await listOrgSupportAgents(input.orgid)) {
    await addConversationMember({ conversationid: conversation.id, userid: agentid, role: "agent" });
  }

  await postSystemMessage({
    conversationid: conversation.id,
    authorid: SUPPORT_AUTHOR_ID,
    authorname: SUPPORT_AUTHOR_NAME,
    content: input.subject?.trim()
      ? `New support request: ${input.subject.trim()}`
      : "You're connected to support. An agent will be with you shortly.",
  });

  // Notify on-shift agents on the org scope (they may not have the conversation
  // open yet). The chat messages themselves flow on `conversation:{id}`.
  await publishEvent({
    type: WSEventType.SupportRequested,
    scope: scopes.org(input.orgid),
    payload: { conversationid: conversation.id, appkey: input.appkey, requesterid: input.requesterid, status: "open" },
  });

  const [row] = await db.select().from(supportsessions).where(eq(supportsessions.id, id)).limit(1);
  return row;
}

/** Open (not-closed) support sessions for an org — the agent queue. */
export async function listOpenSupportSessions(orgid: string): Promise<SupportSessionRow[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(supportsessions)
    .where(and(eq(supportsessions.orgid, orgid), ne(supportsessions.status, "closed")))
    .orderBy(desc(supportsessions.createdat));
}

async function loadSession(id: string): Promise<SupportSessionRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [row] = await db.select().from(supportsessions).where(eq(supportsessions.id, id)).limit(1);
  if (!row) throw new EngineError("support_session_not_found", 404);
  return row;
}

/** An agent claims a session (status -> assigned). Idempotent-ish. */
export async function assignSupportSession(id: string, agentid: string): Promise<SupportSessionRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  await loadSession(id);
  await db
    .update(supportsessions)
    .set({ status: "assigned", assignedagentid: agentid })
    .where(eq(supportsessions.id, id));
  return loadSession(id);
}

export async function closeSupportSession(id: string): Promise<SupportSessionRow> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const session = await loadSession(id);
  await db
    .update(supportsessions)
    .set({ status: "closed", closedat: new Date() })
    .where(eq(supportsessions.id, id));
  await publishEvent({
    type: WSEventType.SupportClosed,
    scope: scopes.org(session.orgid),
    payload: { conversationid: session.conversationid, status: "closed" },
  });
  return loadSession(id);
}
