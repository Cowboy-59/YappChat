import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { aiproviders, type AiProviderRow } from "../db/pa-schema";
import { spaceaichunks, spaceaisources, spaces } from "../db/communities-schema";
import { messages } from "../db/engine-schema";
import { getAdapter } from "../pa/adapters";
import { postSystemMessage } from "../engine/service";
import { AI_ASSISTANT_AUTHOR_ID, AI_ASSISTANT_LABEL, getSpaceAiConfig } from "./spaceai";
import { embedQuery, embeddingsConfigured, toVectorLiteral } from "./embeddings";

/**
 * Spec 017 FR-019 — per-space support AI ("SPOCK AI") retrieval + summon.
 *
 * SPOCK AI answers only when a member names it (see `mentionsSpock`). Retrieval
 * is pgvector semantic search over the space's chunk embeddings (Gemini
 * text-embedding-004, cosine distance via the hnsw index), HARD-SCOPED to a
 * single space's chunks — with a Postgres full-text fallback when embeddings
 * aren't configured — and ALWAYS folds in the space's own prior messages
 * (full-text; 2026-07-13 amendment). The model answers ONLY from the retrieved
 * sources, in the asker's language, and cites them; when nothing relevant is
 * found it declines and reports to the support team (no member is named).
 */

const MAX_CHUNKS = 6;
const MAX_HISTORY = 4;
// Cosine-distance ceiling for a chunk to count as relevant (0 = identical,
// 1 = orthogonal). Vector search always returns k-nearest, so this drops
// clearly-unrelated chunks; the model's NOANSWER path is the final guard.
const VECTOR_MAX_DIST = 0.8;
const NO_ANSWER = "NOANSWER";
// FR-019 (2026-07-13) — the no-answer path reports to the support team and no
// longer names individual members.
const DECLINE_TEXT =
  "I couldn't find this in the docs — I will report this to our support team and someone will help you.";

export type RetrievedSource = { content: string; citation: string };

/** Full-text retrieve the most relevant source chunks for a query within a space. */
async function retrieve(spaceid: string, query: string): Promise<RetrievedSource[]> {
  const db = getDb();
  if (!db) return [];
  const q = query.trim();
  if (!q) return [];

  const tsq = sql`plainto_tsquery('english', ${q})`;
  const cite = (r: { anchor: string; title: string | null; url: string | null; kind: string }) =>
    r.anchor || r.title || r.url || (r.kind === "website" ? "website" : "document");

  const out: RetrievedSource[] = [];

  // ── Source chunks: pgvector semantic search (FR-019), full-text fallback ──
  let usedVector = false;
  if (embeddingsConfigured()) {
    try {
      const qvec = await embedQuery(q);
      if (qvec.length) {
        const dist = sql<number>`${spaceaichunks.embedding} <=> ${toVectorLiteral(qvec)}::vector`;
        const rows = await db
          .select({
            content: spaceaichunks.content,
            anchor: spaceaichunks.anchor,
            url: spaceaisources.url,
            title: spaceaisources.title,
            kind: spaceaisources.kind,
            dist,
          })
          .from(spaceaichunks)
          .innerJoin(spaceaisources, eq(spaceaichunks.sourceid, spaceaisources.id))
          .where(and(eq(spaceaichunks.spaceid, spaceid), isNotNull(spaceaichunks.embedding)))
          .orderBy(dist) // ascending cosine distance = most similar first
          .limit(MAX_CHUNKS);
        for (const r of rows) {
          if (r.dist != null && r.dist <= VECTOR_MAX_DIST) out.push({ content: r.content, citation: cite(r) });
        }
        usedVector = true;
      }
    } catch (err) {
      console.error("[spaceai] vector retrieve failed — falling back to full-text:", err);
    }
  }

  if (!usedVector) {
    const rank = sql<number>`ts_rank(to_tsvector('english', ${spaceaichunks.content}), ${tsq})`;
    const rows = await db
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
    for (const r of rows) out.push({ content: r.content, citation: cite(r) });
  }

  // Always fold in the space's own prior messages (FR-019 amendment 2026-07-13 —
  // SPOCK AI interrogates the pgvector'd docs AND the space history on every
  // summon, regardless of the includehistory config flag).
  const [space] = await db.select({ conversationid: spaces.conversationid }).from(spaces).where(eq(spaces.id, spaceid)).limit(1);
  if (space) {
    const histRank = sql<number>`ts_rank(to_tsvector('english', coalesce(${messages.content}, '')), ${tsq})`;
    const hist = await db
      .select({ content: messages.content, createdat: messages.createdat, rank: histRank })
      .from(messages)
      .where(
        and(
          eq(messages.conversationid, space.conversationid),
          ne(messages.authorid, AI_ASSISTANT_AUTHOR_ID), // don't ground on the bot's own prior replies
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

export type AnswerResult = { answered: boolean; text: string; sources: RetrievedSource[] };

/** Produce a cited answer to `question` grounded only in the space's sources. */
export async function answerQuestion(spaceid: string, question: string): Promise<AnswerResult> {
  const sources = await retrieve(spaceid, question);
  if (!sources.length) {
    return { answered: false, text: DECLINE_TEXT, sources: [] };
  }
  const provider = await resolveBotProvider(spaceid);
  if (!provider) return { answered: false, text: DECLINE_TEXT, sources };

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
      return { answered: false, text: DECLINE_TEXT, sources };
    }
    return { answered: true, text, sources };
  } catch (err) {
    console.error("[spaceai] answer failed:", err);
    return { answered: false, text: DECLINE_TEXT, sources };
  }
}

// FR-019 (2026-07-13) — SPOCK AI is summoned by name, not by a question
// heuristic. Matches "spockai" / "spock ai" / "spock" as a whole word,
// case-insensitive.
const SPOCK_RE = /\bspock\s*ai\b|\bspock\b/i;

/** True when a message addresses the assistant by name ("Spock" / "SpockAI"). */
export function mentionsSpock(text: string): boolean {
  if (text.length > 2000) return false;
  return SPOCK_RE.test(text);
}

/** Strip the summon token so "Spock, how do I X?" retrieves on "how do I X?". */
function stripSpockMention(text: string): string {
  return text
    .replace(/\bspock\s*ai\b/gi, " ")
    .replace(/\bspock\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
 * Summon hook — call after a member message is persisted in a space. If the
 * space's AI is enabled and the message names SPOCK AI ("Spock" / "SpockAI",
 * and isn't from the bot itself), post a cited answer back into the space.
 * Fire-and-forget; never throws into the caller. (FR-019 2026-07-13: name-gated,
 * replacing the earlier "answer anything that looks like a question" behavior.)
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
    if (!content || !mentionsSpock(content)) return;
    const config = await getSpaceAiConfig(input.spaceid);
    if (!config || !config.enabled) return;

    const query = stripSpockMention(content) || content;
    const { answered, text, sources } = await answerQuestion(input.spaceid, query);
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
