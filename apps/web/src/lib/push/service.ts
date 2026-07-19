import { and, eq, inArray, ne } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { pushtokens } from "../db/push-schema";
import { conversationmembers } from "../db/engine-schema";
import { users } from "../db/auth-schema";
import { EngineError } from "../engine/errors";

/**
 * Spec 009 — push notifications via the Expo Push service (which fans out to
 * APNs/FCM). Devices register their Expo push token; on each message we push to the
 * other members' tokens so they're notified even with the app closed. Requires a
 * real build (Expo Go can't get a push token) + APNs/FCM credentials in EAS. Until
 * tokens are registered this is a safe no-op (no tokens → nothing sent).
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Upsert a device push token for the caller (re-owns it if the user changed). */
export async function registerPushToken(
  userid: string,
  input: { token?: string; platform?: string; deviceid?: string | null },
): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  const token = input.token?.trim();
  const platform = input.platform === "ios" || input.platform === "android" ? input.platform : null;
  if (!token || !platform) throw new EngineError("invalid_token", 400);
  await db
    .insert(pushtokens)
    .values({ id: uuidv7(), userid, token, platform, deviceid: input.deviceid ?? null })
    .onConflictDoUpdate({
      target: pushtokens.token,
      set: { userid, platform, deviceid: input.deviceid ?? null, updatedat: new Date() },
    });
}

/** Remove a push token on logout / unregister. */
export async function unregisterPushToken(userid: string, token: string): Promise<void> {
  const db = getDb();
  if (!db || !token) return;
  await db.delete(pushtokens).where(and(eq(pushtokens.token, token), eq(pushtokens.userid, userid)));
}

async function tokensForUsers(userids: string[]): Promise<string[]> {
  const db = getDb();
  if (!db || userids.length === 0) return [];
  const rows = await db.select({ token: pushtokens.token }).from(pushtokens).where(inArray(pushtokens.userid, userids));
  return rows.map((r) => r.token);
}

/** Send an Expo push to a set of tokens (chunked at 100/request). Best-effort. */
async function sendExpoPush(tokens: string[], payload: { title: string; body: string; data?: unknown }): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default" as const,
  }));
  for (let i = 0; i < messages.length; i += 100) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    } catch (err) {
      console.error("[push] send failed:", (err as Error).message);
    }
  }
}

/**
 * Fan out a push for a new message to every HUMAN recipient (members of the
 * conversation, excluding the author and agent users). Non-blocking / best-effort —
 * callers should `void` this so it never delays the send response.
 */
export async function pushMessageFanout(
  conversationid: string,
  authorid: string,
  title: string,
  body: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const members = await db
    .select({ userid: conversationmembers.userid })
    .from(conversationmembers)
    .innerJoin(users, eq(users.id, conversationmembers.userid))
    .where(
      and(
        eq(conversationmembers.conversationid, conversationid),
        ne(conversationmembers.userid, authorid),
        ne(users.kind, "agent"),
      ),
    );
  const tokens = await tokensForUsers(members.map((m) => m.userid));
  await sendExpoPush(tokens, { title, body, data: { conversationid } });
}
