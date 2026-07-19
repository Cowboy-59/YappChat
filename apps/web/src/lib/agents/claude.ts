import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { agentapitokens, users } from "../db/auth-schema";
import { conversationmembers } from "../db/engine-schema";
import { generateToken, hashToken } from "../auth/crypto";
import { EngineError } from "../engine/errors";

/**
 * Spec 091 — "Claude posts as itself" (agent identity).
 *
 * Each project room gets its OWN Claude agent principal (a `users` row with
 * kind='agent', displayname "Claude"), scoped by a per-room email. The external
 * Claude Code agent on the user's machine authenticates with a `yca_…` token
 * (Authorization: Bearer) minted here and posts to the room — messages are then
 * authored by "Claude", not the room owner. Per-room agents keep each token scoped
 * to a single conversation: a token can only post where its agent is a member.
 */

function claudeEmail(conversationid: string): string {
  return `claude+${conversationid}@agent.yappchat.internal`;
}

/** Get-or-create the Claude agent user for a conversation; returns its user id. */
export async function getOrCreateClaudeAgent(conversationid: string): Promise<string> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const email = claudeEmail(conversationid);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing.id;
  await db
    .insert(users)
    .values({ id: uuidv7(), email, displayname: "Claude", kind: "agent" })
    .onConflictDoNothing();
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return row.id;
}

/**
 * Bind a conversation to Claude: ensure the per-room Claude agent is a member and
 * mint a fresh scoped token for it. Caller must be a member of the room. The token
 * is returned once (only its hash is stored) for the user to paste into their
 * machine's Claude agent.
 */
export async function connectClaudeToConversation(
  userid: string,
  conversationid: string,
): Promise<{ token: string; agentid: string }> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const [member] = await db
    .select({ id: conversationmembers.id })
    .from(conversationmembers)
    .where(and(eq(conversationmembers.conversationid, conversationid), eq(conversationmembers.userid, userid)))
    .limit(1);
  if (!member) throw new EngineError("not_a_member", 404);

  const agentid = await getOrCreateClaudeAgent(conversationid);

  // Add Claude as a member of this room (idempotent — unique on (conversation,user)).
  await db
    .insert(conversationmembers)
    .values({ id: uuidv7(), conversationid, userid: agentid, role: "agent" })
    .onConflictDoNothing();

  const token = `yca_${generateToken(24)}`;
  await db.insert(agentapitokens).values({
    id: uuidv7(),
    userid: agentid,
    label: `room:${conversationid}`,
    tokenhash: hashToken(token),
    last6: token.slice(-6),
    createdby: userid,
  });

  return { token, agentid };
}
