import { and, desc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import {
  spaceaichunks,
  spaceaiconfig,
  spaceaisources,
  type SpaceAiConfigRow,
  type SpaceAiSourceRow,
} from "../db/communities-schema";
import { EngineError } from "../engine/errors";

/**
 * Spec 017 FR-019 — per-space support AI: config + knowledge sources.
 *
 * This module owns the per-space AI configuration and its knowledge-source rows
 * (a crawled website snapshot, uploaded documents, and/or the space's own
 * history). Indexing of those sources lives in `spaceai-index.ts`; retrieval +
 * auto-answer in `spaceai-answer.ts`. The acting AI is distinct from the
 * community-wide history RAG of FR-015 and is hard-scoped to one space.
 */

/** Stable author id for bot-posted messages (text column; never a users.id). */
export const AI_ASSISTANT_AUTHOR_ID = "yappchat-ai-assistant";
export const AI_ASSISTANT_LABEL = "Assistant";

const DEFAULT_MODEL = "claude-opus-4-8";

export type SpaceAiSourceInput =
  | { kind: "website"; url: string }
  | { kind: "document"; storagekey: string; title?: string };

export type ConfigureSpaceAiInput = {
  enabled: boolean;
  autoanswer?: boolean;
  includehistory?: boolean;
  model?: string;
  sources?: SpaceAiSourceInput[];
};

export type SpaceAiState = {
  config: SpaceAiConfigRow | null;
  sources: SpaceAiSourceRow[];
};

/** The space's AI config, or null when AI was never enabled for it. */
export async function getSpaceAiConfig(spaceid: string): Promise<SpaceAiConfigRow | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select().from(spaceaiconfig).where(eq(spaceaiconfig.spaceid, spaceid)).limit(1);
  return row ?? null;
}

/** Config + sources for a space (the manage/inspect view). */
export async function getSpaceAiState(spaceid: string): Promise<SpaceAiState> {
  const db = getDb();
  if (!db) return { config: null, sources: [] };
  const [config, sources] = await Promise.all([
    getSpaceAiConfig(spaceid),
    db.select().from(spaceaisources).where(eq(spaceaisources.spaceid, spaceid)).orderBy(desc(spaceaisources.createdat)),
  ]);
  return { config, sources };
}

function normalizeSources(input: SpaceAiSourceInput[] | undefined): SpaceAiSourceInput[] {
  const out: SpaceAiSourceInput[] = [];
  for (const s of input ?? []) {
    if (s.kind === "website") {
      const url = s.url?.trim();
      if (url) out.push({ kind: "website", url });
    } else if (s.kind === "document") {
      const key = s.storagekey?.trim();
      if (key) out.push({ kind: "document", storagekey: key, title: s.title?.trim() || key.split("/").pop() || "document" });
    }
  }
  return out;
}

/**
 * Enable/replace a space's AI config and (re)seed its knowledge sources. The
 * caller is responsible for authorization (owner/mod). Sources are inserted as
 * `pending`; the indexer materializes their chunks. When `includehistory` is
 * set, a singleton `history` source row is ensured so retrieval can include the
 * space's own messages. Returns the persisted state; callers typically then
 * fire `indexSpaceAi(spaceid)` (kept separate so the request can return fast).
 */
export async function configureSpaceAi(spaceid: string, input: ConfigureSpaceAiInput): Promise<SpaceAiState> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);

  const existing = await getSpaceAiConfig(spaceid);
  const now = new Date();
  if (existing) {
    await db
      .update(spaceaiconfig)
      .set({
        enabled: input.enabled,
        autoanswer: input.autoanswer ?? existing.autoanswer,
        includehistory: input.includehistory ?? existing.includehistory,
        model: input.model?.trim() || existing.model,
        updatedat: now,
      })
      .where(eq(spaceaiconfig.id, existing.id));
  } else {
    await db.insert(spaceaiconfig).values({
      id: uuidv7(),
      spaceid,
      enabled: input.enabled,
      autoanswer: input.autoanswer ?? true,
      includehistory: input.includehistory ?? false,
      model: input.model?.trim() || DEFAULT_MODEL,
    });
  }

  // Seed any newly-provided website/document sources (status pending).
  const fresh = normalizeSources(input.sources);
  if (fresh.length) {
    await db.insert(spaceaisources).values(
      fresh.map((s) => ({
        id: uuidv7(),
        spaceid,
        kind: s.kind,
        url: s.kind === "website" ? s.url : null,
        storagekey: s.kind === "document" ? s.storagekey : null,
        title: s.kind === "document" ? (s.title ?? "") : "",
        status: "pending" as const,
      })),
    );
  }

  // Ensure exactly one `history` source row mirrors the includehistory flag.
  const includeHistory = input.includehistory ?? existing?.includehistory ?? false;
  const [historyRow] = await db
    .select()
    .from(spaceaisources)
    .where(and(eq(spaceaisources.spaceid, spaceid), eq(spaceaisources.kind, "history")))
    .limit(1);
  if (includeHistory && !historyRow) {
    await db.insert(spaceaisources).values({
      id: uuidv7(),
      spaceid,
      kind: "history",
      title: "Space history",
      status: "ready", // history is retrieved live, not chunked into spaceaichunks
    });
  } else if (!includeHistory && historyRow) {
    await db.delete(spaceaisources).where(eq(spaceaisources.id, historyRow.id));
  }

  return getSpaceAiState(spaceid);
}

/** Remove all materialized chunks for a space (used before a re-index). */
export async function clearSpaceAiChunks(spaceid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.delete(spaceaichunks).where(eq(spaceaichunks.spaceid, spaceid));
}

/** Mark a source's indexing status (and optional metadata). */
export async function setSourceStatus(
  sourceid: string,
  status: SpaceAiSourceRow["status"],
  patch: { error?: string | null; pagecount?: number | null; crawledat?: Date | null } = {},
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.update(spaceaisources).set({ status, ...patch }).where(eq(spaceaisources.id, sourceid));
}
