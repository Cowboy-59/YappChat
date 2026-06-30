import { EngineError } from "../engine/errors";

/**
 * Spec 071 (Presentation) T006 — GROQ caption engine.
 *
 * Base-language captions come from GROQ Whisper (speech-to-text); per-viewer
 * subtitles come from a GROQ Llama translation. GROQ exposes an OpenAI-compatible
 * API, so these are plain fetch calls — no SDK. Config is env-gated (GROQ_API_KEY);
 * when unset, callers surface "captions unavailable" and the session continues
 * (FR-017). The continuous audio feed is driven by the host's browser (or a
 * LiveKit Agent) posting short chunks to the /captions/transcribe route.
 */
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_BASE = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo";
const GROQ_MT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  pt: "Portuguese",
};

export function captionsConfigured(): boolean {
  return Boolean(GROQ_API_KEY);
}

/** Transcribe one short audio chunk to text in (or auto-detecting) the given language. */
export async function transcribeAudio(audio: Blob, languageHint?: string): Promise<string> {
  if (!captionsConfigured()) throw new EngineError("captions_unconfigured", 503);
  const form = new FormData();
  form.append("file", audio, "chunk.webm");
  form.append("model", GROQ_STT_MODEL);
  form.append("response_format", "json");
  if (languageHint) form.append("language", languageHint);
  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new EngineError("stt_failed", 502, `groq stt ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/** Translate a caption line between two of the supported languages. */
export async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!captionsConfigured()) throw new EngineError("captions_unconfigured", 503);
  if (from === to || !text.trim()) return text;
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MT_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You translate live presentation captions from ${LANG_NAMES[from] ?? from} to ${LANG_NAMES[to] ?? to}. Output ONLY the translated text — no quotes, labels, or notes.`,
        },
        { role: "user", content: text },
      ],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new EngineError("translate_failed", 502, `groq mt ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (data.choices?.[0]?.message?.content ?? text).trim();
}
