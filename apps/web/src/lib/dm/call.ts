import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { conversations, conversationmembers } from "../db/engine-schema";
import { EngineError } from "../engine/errors";
import { publishEvent } from "../ws/broker";
import { scopes, WSEventType } from "../ws/events";

/**
 * Spec 087 (1:1 DM call slice) — signaling for a simple two-party audio/video
 * call in a `person` DM. The media rides LiveKit (room `dm-call-<conversationid>`,
 * minted by the token route); this module only resolves the peer and relays
 * ring/accept/decline/end over the peer's `user:{id}` WS scope.
 */

/** Resolve the other member of a 1:1 `person` DM; throws if not a valid 2-party DM. */
export async function resolveDmPeer(conversationid: string, userid: string): Promise<string> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const [conv] = await db
    .select({ kind: conversations.kind })
    .from(conversations)
    .where(eq(conversations.id, conversationid))
    .limit(1);
  if (!conv) throw new EngineError("conversation_not_found", 404);
  if (conv.kind !== "person") throw new EngineError("not_a_dm", 400);
  const members = await db
    .select({ userid: conversationmembers.userid })
    .from(conversationmembers)
    .where(eq(conversationmembers.conversationid, conversationid));
  if (!members.some((m) => m.userid === userid)) throw new EngineError("not_a_member", 403);
  if (members.length !== 2) throw new EngineError("not_a_dm", 400);
  return members.find((m) => m.userid !== userid)!.userid;
}

export type CallSignal = "ring" | "accept" | "decline" | "end";
const SIGNAL_EVENT: Record<CallSignal, string> = {
  ring: WSEventType.CallRing,
  accept: WSEventType.CallAccepted,
  decline: WSEventType.CallDeclined,
  end: WSEventType.CallEnded,
};

/** Relay a call signal to the DM peer's user scope. */
export async function sendCallSignal(
  conversationid: string,
  fromUserId: string,
  fromName: string | null,
  type: CallSignal,
): Promise<void> {
  const peer = await resolveDmPeer(conversationid, fromUserId);
  await publishEvent({
    type: SIGNAL_EVENT[type],
    scope: scopes.user(peer),
    payload: {
      conversationid,
      fromUserId,
      callername: fromName,
      route: `/chats?conv=${conversationid}`,
    },
  });
}
