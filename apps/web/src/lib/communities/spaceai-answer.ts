import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { aiproviders, type AiProviderRow } from "../db/pa-schema";
import { communitymembers, spaceaichunks, spaceaisources, spaces } from "../db/communities-schema";
import { messages } from "../db/engine-schema";
import { getAdapter } from "../pa/adapters";
import { postSystemMessage } from "../engine/service";
import { AI_ASSISTANT_AUTHOR_ID, AI_ASSISTANT_LABEL, getSpaceAiConfig } from "./spaceai";

/**
 * Spec 017 FR-019 — per-space support AI retrieval + auto-answer.
 *
 * Retrieval is Postgres full-text, HARD-SCOPED to a single space's chunks (and,
 * if enabled, that space's own message history). The model answers ONLY from the
 * retrieved sources, in the asker's language, and cites them; when nothing
 * relevant is found it declines and surfaces an available human (FR-007).
 */

const MAX_CHUNKS = 6;
const MAX_HISTORY = 4;
const NO_ANSWER = "NOANSWER";

export type RetrievedSource = { content: string; citation: string };

/** Full-text retrieve the most relevant source chunks for a query within a space. */
async function retrieve(spaceid: string, query: string): Promise<RetrievedSource[]> {
  const db = getDb();
  if (!db) return [];
  const q = query.trim();
  if (!q) return [];

  const tsq = sql`plainto_tsquery('english', ${q})`;
  const rank = sql<number>`ts_rank(to_tsvector('english', ${spaceaichunks.content}), ${tsq})`;

  const chunkRows = await db
    .select({
      content: spaceaichunks.content,
      anchor: spaceaichunks.anchor,
      url: spaceaisources.url,
      title: spaceaisources.title,
      kind: spaceaisources.kind,
      rank,
    })
    .from(spaceaichunks)
    .innerJoin(spaceaisources, eq(spaceaichunks.sourceid, spaceaisources.id))
    .where(and(eq(spaceaichunks.spaceid, spaceid), sql`to_tsvector('english', ${spaceaichunks.content}) @@ ${tsq}`))
    .orderBy(desc(rank))
    .limit(MAX_CHUNKS);

  const out: RetrievedSource[] = chunkRows.map((r) => ({
    content: r.content,
    citation: r.anchor || r.title || r.url || (r.kind === "website" ? "website" : "document"),
  }));

  // Optionally fold in the space's own history.
  const config = await getSpaceAiConfig(spaceid);
  if (config?.includehistory) {
    const [space] = await db.select({ conversationid: spaces.conversationid }).from(spaces).where(eq(spaces.id, spaceid)).limit(1);
    if (space) {
      const histRank = sql<number>`ts_rank(to_tsvector('english', coalesce(${messages.content}, '')), ${tsq})`;
      const hist = await db
        .select({ content: messages.content, createdat: messages.createdat, rank: histRank })
        .from(messages)
        .where(
          and(
            eq(messages.conversationid, space.conversationid),
            isNotNull(messages.content),
            sql`to_tsvector('english', coalesce(${messages.content}, '')) @@ ${tsq}`,
          ),
        )
        .orderBy(desc(histRank))
        .limit(MAX_HISTORY);
      for (const h of hist) {
        if (h.content) out.push({ content: h.content, citation: `earlier message (${h.createdat.toISOString().slice(0, 10)})` });
      }
    }
  }
  return out;
}

/** The system-default AI provider, with the model overridden per space config. */
async function resolveBotProvider(spaceid: string): Promise<AiProviderRow | null> {
  const db = getDb();
  if (!db) return null;
  const config = await getSpaceAiConfig(spaceid);
  const [def] = await db.select().from(aiproviders).where(eq(aiproviders.isdefault, true)).limit(1);
  if (!def) return null;
  // Honor the per-space model only for Anthropic providers (the default).
  if (def.type === "anthropic" && config?.model) return { ...def, model: config.model };
  return def;
}

/** Names of up to two community members flagged "available to help" (FR-007). */
async function availableHelpers(spaceid: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const [space] = await db.select({ communityid: spaces.communityid }).from(spaces).where(eq(spaces.id, spaceid)).limit(1);
  if (!space) return [];
  const rows = await db
    .select({ status: communitymembers.availabilitystatus, userid: communitymembers.userid })
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, space.communityid), isNotNull(communitymembers.availabilitystatus)))
    .limit(2);
  // Resolve display names via the users table (auth-schema) — best-effort.
  const { users } = await import("../db/auth-schema");
  const out: string[] = [];
  for (const r of rows) {
    const [u] = await db.select({ name: users.displayname, email: users.email }).from(users).where(eq(users.id, r.userid)).limit(1);
    const label = u?.name?.trim() || u?.email?.split("@")[0];
    if (label) out.push(label);
  }
  return out;
}

export type AnswerResult = { answered: boolean; text: string; sources: RetrievedSource[] };

/** Produce a cited answer to `question` grounded only in the space's sources. */
export async function answerQuestion(spaceid: string, question: string): Promise<AnswerResult> {
  const sources = await retrieve(spaceid, question);
  if (!sources.length) {
    return { answered: false, text: await declineText(spaceid), sources: [] };
  }
  const provider = await resolveBotProvider(spaceid);
  if (!provider) return { answered: false, text: await declineText(spaceid), sources };

  const context = sources.map((s, i) => `[Source ${i + 1}: ${s.citation}]\n${s.content}`).join("\n\n---\n\n");
  const system =
    "You are a community support assistant for a single chat space. Answer the user's question " +
    "USING ONLY the numbered sources provided — never use outside knowledge. Cite the sources you " +
    "use inline as [1], [2], etc. Reply in the SAME LANGUAGE as the question. Be concise and friendly. " +
    `If the sources do not contain the answer, reply with exactly "${NO_ANSWER}" and nothing else.`;
  const user = `Question:\n${question}\n\nSources:\n${context}`;

  try {
    const res = await getAdapter(provider).complete({ system, messages: [{ role: "user", content: user }], maxTokens: 700 });
    const text = res.text.trim();
    if (!text || text.toUpperCase().startsWith(NO_ANSWER)) {
      return { answered: false, text: await declineText(spaceid), sources };
    }
    return { answered: true, text, sources };
  } catch (err) {
    console.error("[spaceai] answer failed:", err);
    return { answered: false, text: await declineText(spaceid), sources };
  }
}

/** The no-answer message, pointing at an available human when possible. */
async function declineText(spaceid: string): Promise<string> {
  const helpers = await availableHelpers(spaceid);
  const base = "I couldn't find an answer to that in this space's documentation.";
  if (helpers.length) return `${base} You may want to ask ${helpers.join(" or ")}, who are available to help.`;
  return `${base} A member of the community may be able to help.`;
}

/** Heuristic: does this message look like a question / support request? */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 3 || t.length > 1000) return false;
  if (t.includes("?")) return true;
  return /^(how|what|why|when|where|who|which|can|could|would|should|does|do|is|are|will|help|i can't|i cannot|i'm stuck|having trouble)\b/.test(
    t,
  );
}

/**
 * Resolve a conversation to its space and run the auto-answer hook. Cheap no-op
 * (one indexed lookup) when the conversation isn't an AI-enabled space — safe to
 * fire-and-forget from the generic engine message route.
 */
export async function maybeAutoAnswerForConversation(
  conversationid: string,
  authorid: string,
  content: string | null,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [space] = await db.select({ id: spaces.id }).from(spaces).where(eq(spaces.conversationid, conversationid)).limit(1);
  if (!space) return;
  await maybeAutoAnswer({ spaceid: space.id, conversationid, authorid, content });
}

/**
 * Auto-answer hook — call after a member message is persisted in a space. If the
 * space's AI is enabled with auto-answer on and the message looks like a
 * question (and isn't from the bot itself), post a cited answer back into the
 * space. Fire-and-forget; never throws into the caller.
 */
export async function maybeAutoAnswer(input: {
  spaceid: string;
  conversationid: string;
  authorid: string;
  content: string | null;
}): Promise<void> {
  try {
    if (input.authorid === AI_ASSISTANT_AUTHOR_ID) return; // don't answer ourselves
    const content = input.content?.trim();
    if (!content || !looksLikeQuestion(content)) return;
    const config = await getSpaceAiConfig(input.spaceid);
    if (!config || !config.enabled || !config.autoanswer) return;

    const { answered, text, sources } = await answerQuestion(input.spaceid, content);
    const citations = answered && sources.length ? `\n\nSources: ${sources.map((s) => s.citation).join("; ")}` : "";
    await postSystemMessage({
      conversationid: input.conversationid,
      authorid: AI_ASSISTANT_AUTHOR_ID,
      authorname: AI_ASSISTANT_LABEL,
      content: text + citations,
    });
  } catch (err) {
    console.error("[spaceai] auto-answer hook failed:", err);
  }
}
