import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { messagetranslations } from "../db/engine-schema";
import { EngineError } from "../engine/errors";

/**
 * Spec 017 FR-012 + spec 018 FR-018-TR-* — per-viewer chat message translation.
 *
 * A message is translated into a given target language at most once (cached in
 * `messagetranslations`) and reused by every viewer sharing that language;
 * a same-language view performs zero model calls. Code blocks are never
 * translated — they are masked out deterministically before the model call and
 * restored after, so the guarantee does not rely on model compliance.
 *
 * Engine: a fast MT model. **Groq (Llama)** is the primary — already configured
 * in the app env and used by the presentation-caption path — with **Gemini** as
 * a drop-in fallback when `GEMINI_API_KEY` is present. Provider order can be
 * pinned via `CHAT_TRANSLATE_PROVIDER` ("groq" | "gemini").
 *
 * This foundation slice implements the PLAINTEXT tier (space messages, 017).
 * The escrow-DM tier (018 §7 — decrypt → translate → write `encryptedpayload`
 * under the conversation DEK) lands with spec 018 §7 and reuses this same cache
 * row shape; until then the resolver writes `translatedcontent` only.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_BASE = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_BASE = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

type Provider = "groq" | "gemini";

/** Providers to try, in order — honors CHAT_TRANSLATE_PROVIDER, else Groq→Gemini. */
function providerChain(): Provider[] {
  const pinned = (process.env.CHAT_TRANSLATE_PROVIDER ?? "").toLowerCase();
  const all: Provider[] = pinned === "gemini" ? ["gemini", "groq"] : ["groq", "gemini"];
  return all.filter((p) => (p === "groq" ? GROQ_API_KEY : GEMINI_API_KEY));
}

export function translationConfigured(): boolean {
  return providerChain().length > 0;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

// Fenced code blocks are masked to sentinels the model is told to keep verbatim,
// then restored — a hard guarantee that code is never translated (FR-012).
const FENCE_RE = /```[\s\S]*?```/g;
const SENTINEL_RE = /〖CODE(\d+)〗/g; // 〖CODE0〗 — glyphs unlikely to appear in prose

function maskCode(text: string): { masked: string; blocks: string[] } {
  const blocks: string[] = [];
  const masked = text.replace(FENCE_RE, (m) => {
    blocks.push(m);
    return `〖CODE${blocks.length - 1}〗`;
  });
  return { masked, blocks };
}

function restoreCode(masked: string, blocks: string[]): string {
  return masked.replace(SENTINEL_RE, (_, i) => blocks[Number(i)] ?? "");
}

function systemPrompt(from: string, to: string): string {
  return (
    `You translate chat messages from ${LANG_NAMES[from] ?? from} to ${LANG_NAMES[to] ?? to}. ` +
    `Output ONLY the translated message — no quotes, labels, or notes. ` +
    `Preserve markdown formatting. Any token of the form 〖CODEn〗 is a placeholder for a code block: ` +
    `keep every such token EXACTLY as-is and never translate or alter it.`
  );
}

async function callGroq(system: string, user: string): Promise<string> {
  const res = await fetch(`${GROQ_BASE.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new EngineError("translate_failed", 502, `groq ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function callGemini(system: string, user: string): Promise<string> {
  const url = `${GEMINI_BASE.replace(/\/+$/, "")}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new EngineError("translate_failed", 502, `gemini ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
}

/**
 * Translate one chat message body between two supported languages. No-op when
 * the languages match or the text is empty/whitespace. Fenced code blocks are
 * preserved verbatim. Tries each configured provider in order (Groq→Gemini) so a
 * single provider outage degrades to the other rather than failing.
 */
export async function translateText(text: string, from: string, to: string): Promise<string> {
  if (from === to || !text.trim()) return text;

  const { masked, blocks } = maskCode(text);
  // An all-code message (only sentinels + whitespace) has nothing to translate —
  // short-circuit before requiring config or a model call.
  if (!masked.replace(SENTINEL_RE, "").trim()) return text;

  const chain = providerChain();
  if (chain.length === 0) throw new EngineError("translation_unconfigured", 503);

  const system = systemPrompt(from, to);
  let lastErr: unknown;
  for (const provider of chain) {
    try {
      const out = provider === "groq" ? await callGroq(system, masked) : await callGemini(system, masked);
      if (out) return restoreCode(out, blocks);
    } catch (err) {
      lastErr = err; // try the next provider
    }
  }
  throw lastErr ?? new EngineError("translate_failed", 502);
}

export type ResolvedTranslation = {
  langcode: string;
  sourcelang: string;
  content: string;
  /** true when served from (or written to) the cache; false for a same-language no-op. */
  cached: boolean;
  /** true when source === target, so no translation was needed. */
  sameLanguage: boolean;
};

// Coalesce concurrent requests for the same (message, target) so a hot message
// is translated at most once even under a burst (cache-stampede guard).
const inflight = new Map<string, Promise<ResolvedTranslation>>();

/**
 * Resolve a message into a target language: cache hit → return; same language →
 * no-op; otherwise translate once, cache, and return. `text`/`sourcelang` are
 * supplied by the caller (which already loaded the message + author language),
 * keeping this resolver decoupled from the message store.
 */
export async function resolveMessageTranslation(input: {
  messageid: string;
  text: string;
  sourcelang: string;
  targetlang: string;
}): Promise<ResolvedTranslation> {
  const { messageid, text, sourcelang, targetlang } = input;

  if (sourcelang === targetlang) {
    return { langcode: targetlang, sourcelang, content: text, cached: false, sameLanguage: true };
  }

  const key = `${messageid}:${targetlang}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const work = (async (): Promise<ResolvedTranslation> => {
    const db = getDb();
    if (!db) throw new EngineError("db_unavailable", 503);

    // Cache hit — reused by every viewer sharing this language.
    const [hit] = await db
      .select({ content: messagetranslations.translatedcontent, sourcelang: messagetranslations.sourcelang })
      .from(messagetranslations)
      .where(and(eq(messagetranslations.messageid, messageid), eq(messagetranslations.langcode, targetlang)))
      .limit(1);
    if (hit?.content != null) {
      return { langcode: targetlang, sourcelang: hit.sourcelang, content: hit.content, cached: true, sameLanguage: false };
    }

    const content = await translateText(text, sourcelang, targetlang);

    // Write-through cache. onConflictDoNothing: a concurrent writer on another
    // process may have won the race; the unique (messageid,langcode) index holds.
    await db
      .insert(messagetranslations)
      .values({ id: uuidv7(), messageid, langcode: targetlang, sourcelang, translatedcontent: content })
      .onConflictDoNothing({ target: [messagetranslations.messageid, messagetranslations.langcode] });

    return { langcode: targetlang, sourcelang, content, cached: true, sameLanguage: false };
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}
