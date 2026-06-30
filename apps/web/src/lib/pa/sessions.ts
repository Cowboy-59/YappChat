import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { aiproviders, assistantmessages, assistantsessions } from "../db/pa-schema";
import { PaError } from "./errors";
import { resolveProviderRow } from "./providers";
import type { ChatMessage } from "./adapters";

/** Spec 002 T005 — named multi-turn assistant sessions (platform mode). */

const CONTEXT_WINDOW = 20;

export async function createSession(
  userid: string,
  opts: { name?: string; providerid?: string },
): Promise<{ id: string; name: string; providerid: string | null }> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);

  const provider = await resolveProviderRow(userid, opts.providerid);
  const id = uuidv7();
  const name = opts.name?.trim() || defaultName();
  await db.insert(assistantsessions).values({
    id,
    userid,
    name,
    providerid: provider?.id ?? null, // frozen at create
  });
  return { id, name, providerid: provider?.id ?? null };
}

function defaultName(): string {
  // Avoid Date.now()/new Date() formatting concerns — a simple stable label.
  return "New chat";
}

export type SessionSummary = {
  id: string;
  name: string;
  providerid: string | null;
  lastmessageat: string;
  createdat: string;
  preview: string;
};

export async function listSessions(userid: string): Promise<SessionSummary[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(assistantsessions)
    .where(and(eq(assistantsessions.userid, userid), isNull(assistantsessions.deletedat)))
    .orderBy(desc(assistantsessions.lastmessageat));

  const out: SessionSummary[] = [];
  for (const s of rows) {
    const [last] = await db
      .select({ content: assistantmessages.content })
      .from(assistantmessages)
      .where(eq(assistantmessages.sessionid, s.id))
      .orderBy(desc(assistantmessages.createdat))
      .limit(1);
    out.push({
      id: s.id,
      name: s.name,
      providerid: s.providerid,
      lastmessageat: s.lastmessageat.toISOString(),
      createdat: s.createdat.toISOString(),
      preview: (last?.content ?? "").slice(0, 60),
    });
  }
  return out;
}

export async function loadSession(userid: string, id: string) {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  const [row] = await db
    .select()
    .from(assistantsessions)
    .where(and(eq(assistantsessions.id, id), eq(assistantsessions.userid, userid)))
    .limit(1);
  if (!row || row.deletedat) throw new PaError("session_not_found", 404);
  return row;
}

export async function getSessionDetail(userid: string, id: string) {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  const session = await loadSession(userid, id);
  let providerLabel: string | null = null;
  if (session.providerid) {
    const [p] = await db
      .select({ name: aiproviders.name, model: aiproviders.model })
      .from(aiproviders)
      .where(eq(aiproviders.id, session.providerid))
      .limit(1);
    if (p) providerLabel = `${p.name} (${p.model})`;
  }
  return {
    id: session.id,
    name: session.name,
    providerid: session.providerid,
    providerLabel,
    createdat: session.createdat.toISOString(),
  };
}

export async function renameSession(userid: string, id: string, name: string): Promise<void> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  await loadSession(userid, id);
  await db.update(assistantsessions).set({ name: name.trim() || "New chat" }).where(eq(assistantsessions.id, id));
}

export async function softDeleteSession(userid: string, id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  await loadSession(userid, id);
  await db.update(assistantsessions).set({ deletedat: new Date() }).where(eq(assistantsessions.id, id));
}

export type MessageRow = {
  id: string;
  role: "user" | "assistant" | "tool_result";
  content: string;
  createdat: string;
};

export async function listMessages(
  userid: string,
  id: string,
  opts: { before?: string; limit?: number },
): Promise<MessageRow[]> {
  const db = getDb();
  if (!db) return [];
  await loadSession(userid, id);
  const limit = Math.min(opts.limit ?? 50, 100);
  const where = opts.before
    ? and(eq(assistantmessages.sessionid, id), lt(assistantmessages.createdat, new Date(opts.before)))
    : eq(assistantmessages.sessionid, id);
  const rows = await db
    .select()
    .from(assistantmessages)
    .where(where)
    .orderBy(desc(assistantmessages.createdat))
    .limit(limit);
  return rows
    .reverse()
    .map((m) => ({ id: m.id, role: m.role, content: m.content, createdat: m.createdat.toISOString() }));
}

export async function appendMessage(
  sessionid: string,
  role: "user" | "assistant" | "tool_result",
  content: string,
  tokens?: { prompt?: number; completion?: number },
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.insert(assistantmessages).values({
    id: uuidv7(),
    sessionid,
    role,
    content,
    prompttokens: tokens?.prompt ?? null,
    completiontokens: tokens?.completion ?? null,
  });
  await db
    .update(assistantsessions)
    .set({ lastmessageat: new Date() })
    .where(eq(assistantsessions.id, sessionid));
}

/** Last N user/assistant turns for the provider context window. */
export async function getContext(sessionid: string): Promise<ChatMessage[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(assistantmessages)
    .where(eq(assistantmessages.sessionid, sessionid))
    .orderBy(asc(assistantmessages.createdat));
  return rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-CONTEXT_WINDOW)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}
