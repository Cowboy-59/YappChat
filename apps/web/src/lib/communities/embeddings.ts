import { EngineError } from "../engine/errors";

/**
 * Spec 017 FR-019 / FR-015 — text embeddings for pgvector semantic search.
 *
 * Uses Gemini `gemini-embedding-001` pinned to 768 output dims — the app already
 * carries a Gemini key (also the chat-translation fallback). Groq has no embedding
 * endpoint. When unconfigured, callers fall back to Postgres full-text search, so
 * the AI still answers (less precisely) rather than failing. Retrieval uses cosine
 * distance, which is scale-invariant, so the truncated (unnormalized) vectors are
 * fine without manual normalization.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_BASE = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";

/** Dimensions of the embedding — MUST match `vector(N)` in migration 0026. */
export const EMBED_DIM = 768;

export function embeddingsConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

/** Serialize a vector to the pgvector text literal `[a,b,…]` for a raw-SQL param. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/**
 * Embed a batch of texts. Returns one 768-dim vector per input, in order.
 * Batches of 100 per request (Gemini's batch cap). Throws if unconfigured or on
 * a hard API failure so the caller can decide to fall back.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!embeddingsConfigured()) throw new EngineError("embeddings_unconfigured", 503);
  if (texts.length === 0) return [];

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await fetch(
      `${GEMINI_BASE.replace(/\/+$/, "")}/models/${EMBED_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((t) => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: t }] },
            outputDimensionality: EMBED_DIM,
          })),
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new EngineError("embed_failed", 502, `gemini embed ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
    for (const e of data.embeddings ?? []) out.push(e.values ?? []);
  }
  return out;
}

/** Embed a single query string → its 768-dim vector. */
export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v ?? [];
}
