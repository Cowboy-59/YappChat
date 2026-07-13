import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { spaceaichunks, spaceaiconfig, spaceaisources, type SpaceAiSourceRow } from "../db/communities-schema";
import { getObjectBytes } from "../storage/s3";
import { getSpaceAiConfig, setSourceStatus } from "./spaceai";
import { embedTexts, embeddingsConfigured } from "./embeddings";

/**
 * Spec 017 FR-019 — knowledge-source indexing for the per-space support AI.
 *
 * Materializes owner-provided sources into retrievable `spaceaichunks`:
 *  - website: a ONE-TIME same-host crawl (robots-respecting, page-capped) into a
 *    text snapshot; re-run only on an explicit owner refresh.
 *  - document: PDF / DOCX / Markdown / TXT / HTML parsed to text.
 *  - history: NOT chunked here — retrieved live from the space's messages.
 *
 * v1 retrieval is Postgres full-text over chunk `content` (see spaceai-answer);
 * each chunk is embedded (Gemini) into the pgvector `embedding` column for
 * semantic retrieval; full-text is the fallback when embeddings are unconfigured.
 */

const USER_AGENT = "YappChatBot/1.0 (+https://yappchat.example/bot)";
const PAGE_CAP = 20; // max pages crawled per website source (v1 snapshot)
const FETCH_TIMEOUT_MS = 15_000;
const MAX_FETCH_BYTES = 5 * 1024 * 1024; // skip huge pages/docs
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS_PER_SOURCE = 1500;

// ── Text utilities ────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Strip a full HTML document to readable text (drops script/style/nav noise). */
export function htmlToText(html: string): string {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(body)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim().slice(0, 200) : null;
}

/** Split text into overlapping chunks on paragraph boundaries. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = t.length > CHUNK_OVERLAP ? t.slice(-CHUNK_OVERLAP) : "";
  };
  for (const para of paras) {
    // A single oversized paragraph is hard-split.
    if (para.length > CHUNK_CHARS) {
      if (buf.trim()) flush();
      for (let i = 0; i < para.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
        chunks.push(para.slice(i, i + CHUNK_CHARS).trim());
        if (chunks.length >= MAX_CHUNKS_PER_SOURCE) return chunks;
      }
      continue;
    }
    if (buf.length + para.length + 2 > CHUNK_CHARS) flush();
    buf += (buf ? "\n\n" : "") + para;
    if (chunks.length >= MAX_CHUNKS_PER_SOURCE) return chunks;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.slice(0, MAX_CHUNKS_PER_SOURCE);
}

async function fetchWithLimits(url: string, accept: string): Promise<{ body: Buffer; contentType: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok || !res.body) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FETCH_BYTES) return null;
    return { body: buf, contentType: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Website crawl ─────────────────────────────────────────────────────────────

/** Minimal robots.txt gate: honor Disallow rules for `*` (and our UA). */
async function loadDisallows(origin: string): Promise<string[]> {
  const got = await fetchWithLimits(`${origin}/robots.txt`, "text/plain").catch(() => null);
  if (!got) return [];
  const lines = got.body.toString("utf8").split("\n");
  const disallows: string[] = [];
  let applies = false;
  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const key = field.trim().toLowerCase();
    if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("yappchat");
    else if (key === "disallow" && applies && value) disallows.push(value);
  }
  return disallows;
}

function sameHostLinks(html: string, base: URL): string[] {
  const out = new Set<string>();
  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const u = new URL(m[1], base);
      if ((u.protocol === "http:" || u.protocol === "https:") && u.host === base.host) {
        u.hash = "";
        out.add(u.toString());
      }
    } catch {
      /* skip malformed */
    }
  }
  return [...out];
}

type Page = { url: string; title: string | null; text: string };

async function crawlWebsite(seed: string): Promise<Page[]> {
  const start = new URL(seed);
  const origin = start.origin;
  const disallows = await loadDisallows(origin);
  const allowed = (path: string) => !disallows.some((d) => path.startsWith(d));

  const queue: string[] = [start.toString()];
  const seen = new Set<string>(queue);
  const pages: Page[] = [];

  while (queue.length && pages.length < PAGE_CAP) {
    const url = queue.shift()!;
    const path = new URL(url).pathname;
    if (!allowed(path)) continue;
    const got = await fetchWithLimits(url, "text/html");
    if (!got || !got.contentType.includes("html")) continue;
    const html = got.body.toString("utf8");
    const text = htmlToText(html);
    if (text.length > 40) pages.push({ url, title: htmlTitle(html), text });
    for (const link of sameHostLinks(html, new URL(url))) {
      if (!seen.has(link) && seen.size < PAGE_CAP * 5) {
        seen.add(link);
        queue.push(link);
      }
    }
  }
  return pages;
}

// ── Document parsing ──────────────────────────────────────────────────────────

async function parseDocument(buf: Buffer, name: string): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const res = await parser.getText();
      return res.text ?? "";
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: buf });
    return res.value ?? "";
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return htmlToText(buf.toString("utf8"));
  // Markdown / txt / anything text-ish.
  return buf.toString("utf8");
}

// ── Orchestration ─────────────────────────────────────────────────────────────

async function insertChunks(
  spaceid: string,
  sourceid: string,
  pieces: Array<{ content: string; anchor: string }>,
): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const filtered = pieces.filter((p) => p.content.trim());
  if (!filtered.length) return 0;

  // Embed each chunk for pgvector semantic retrieval (FR-019). Best-effort: if
  // embeddings aren't configured or the call fails, store the chunks text-only so
  // the full-text fallback still answers.
  let embeddings: number[][] | null = null;
  if (embeddingsConfigured()) {
    try {
      embeddings = await embedTexts(filtered.map((p) => p.content));
    } catch (err) {
      console.error("[spaceai] embedding failed — storing chunks text-only:", err);
      embeddings = null;
    }
  }

  const rows = filtered.map((p, i) => ({
    id: uuidv7(),
    spaceid,
    sourceid,
    content: p.content,
    anchor: p.anchor.slice(0, 500),
    tokens: Math.ceil(p.content.length / 4),
    embedding: embeddings?.[i]?.length ? embeddings[i] : null,
  }));
  // Insert in batches to stay under parameter limits.
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(spaceaichunks).values(rows.slice(i, i + 200));
  }
  return rows.length;
}

/** Index one source (website or document); throws on hard failure. */
async function indexSource(source: SpaceAiSourceRow): Promise<{ chunks: number; pages: number }> {
  const db = getDb();
  if (!db) return { chunks: 0, pages: 0 };
  // Idempotent: clear any prior chunks for this source before re-materializing.
  await db.delete(spaceaichunks).where(eq(spaceaichunks.sourceid, source.id));

  if (source.kind === "website") {
    if (!source.url) throw new Error("website source missing url");
    const pages = await crawlWebsite(source.url);
    if (!pages.length) throw new Error("no crawlable pages");
    let total = 0;
    for (const page of pages) {
      const anchor = page.title ? `${page.title} — ${page.url}` : page.url;
      total += await insertChunks(
        source.spaceid,
        source.id,
        chunkText(page.text).map((c) => ({ content: c, anchor })),
      );
    }
    return { chunks: total, pages: pages.length };
  }

  if (source.kind === "document") {
    if (!source.storagekey) throw new Error("document source missing storagekey");
    const buf = await getObjectBytes(source.storagekey);
    const text = await parseDocument(buf, source.title || source.storagekey);
    const label = source.title || source.storagekey.split("/").pop() || "document";
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("no extractable text");
    const n = await insertChunks(source.spaceid, source.id, chunks.map((c, i) => ({ content: c, anchor: `${label} · part ${i + 1}` })));
    return { chunks: n, pages: 1 };
  }

  return { chunks: 0, pages: 0 }; // history — retrieved live, nothing to materialize
}

/**
 * Index all not-yet-ready sources for a space, then stamp `lastindexedat`. Safe
 * to call fire-and-forget; per-source failures are recorded on the source row
 * (status=error) without aborting the others. No-op if AI is disabled.
 */
export async function indexSpaceAi(spaceid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const config = await getSpaceAiConfig(spaceid);
  if (!config || !config.enabled) return;

  const sources = await db
    .select()
    .from(spaceaisources)
    .where(eq(spaceaisources.spaceid, spaceid));

  for (const source of sources) {
    if (source.kind === "history") continue;
    if (source.status === "ready") continue; // already materialized
    await setSourceStatus(source.id, "indexing", { error: null });
    try {
      const { pages } = await indexSource(source);
      await setSourceStatus(source.id, "ready", { pagecount: pages, crawledat: new Date(), error: null });
    } catch (err) {
      await setSourceStatus(source.id, "error", { error: (err as Error).message.slice(0, 500) });
    }
  }

  await db.update(spaceaiconfig).set({ lastindexedat: new Date(), updatedat: new Date() }).where(eq(spaceaiconfig.spaceid, spaceid));
}

/** Owner refresh — reset website/document sources to pending and re-crawl. */
export async function refreshSpaceAi(spaceid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(spaceaisources)
    .set({ status: "pending", error: null })
    .where(eq(spaceaisources.spaceid, spaceid));
  // Re-mark history rows ready (they are never crawled).
  const sources = await db.select().from(spaceaisources).where(eq(spaceaisources.spaceid, spaceid));
  for (const s of sources) {
    if (s.kind === "history") await setSourceStatus(s.id, "ready");
  }
  await indexSpaceAi(spaceid);
}
