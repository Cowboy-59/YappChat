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

/**
 * Whisper hallucinates filler phrases on silent/near-silent audio ("Thank you.",
 * "Thanks for watching", etc.). We drop a caption chunk when it is (a) flagged as
 * non-speech / low-confidence by Whisper's per-segment metadata, or (b) exactly one
 * of these known hallucination phrases.
 */
const HALLUCINATION_PHRASES = new Set([
  "thank you",
  "thank you.",
  "thanks for watching",
  "thanks for watching!",
  "thank you for watching",
  "please subscribe",
  "you",
  "bye",
  "bye.",
  ".",
]);

/** Transcribe one short audio chunk to text in (or auto-detecting) the given language. */
export async function transcribeAudio(audio: Blob, languageHint?: string): Promise<string> {
  if (!captionsConfigured()) throw new EngineError("captions_unconfigured", 503);
  const form = new FormData();
  form.append("file", audio, "chunk.webm");
  form.append("model", GROQ_STT_MODEL);
  // verbose_json exposes per-segment no_speech_prob + avg_logprob so we can reject
  // silence hallucinations instead of surfacing them as captions.
  form.append("response_format", "verbose_json");
  if (languageHint) form.append("language", languageHint);
  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[captions] GROQ STT failed", res.status, body.slice(0, 400));
    throw new EngineError("stt_failed", 502, `groq stt ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    text?: string;
    segments?: Array<{ no_speech_prob?: number; avg_logprob?: number }>;
  };
  const text = (data.text ?? "").trim();
  if (!text) return "";

  // Reject chunks Whisper itself considers non-speech or very low confidence.
  const segs = data.segments ?? [];
  if (segs.length) {
    const allNoSpeech = segs.every((s) => (s.no_speech_prob ?? 0) > 0.6);
    const allLowConf = segs.every((s) => (s.avg_logprob ?? 0) < -1.0);
    if (allNoSpeech || allLowConf) return "";
  }
  // Reject a chunk that is exactly a known hallucination phrase.
  if (HALLUCINATION_PHRASES.has(text.toLowerCase())) return "";
  return text;
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

/**
 * FR-028 — summarize a presentation's chat transcript into a short recap. Returns
 * null when GROQ isn't configured or the call fails, so the transcript still shows.
 */
export async function summarizeChat(lines: Array<{ name: string; text: string }>): Promise<string | null> {
  if (!captionsConfigured() || lines.length === 0) return null;
  const transcript = lines.map((l) => `${l.name}: ${l.text}`).join("\n").slice(0, 6000);
  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You summarize the chat from a live presentation into a concise recap (2-4 sentences or a few short bullets). Capture the main questions, answers, and topics. Output only the summary — no preamble.",
          },
          { role: "user", content: transcript },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const out = data.choices?.[0]?.message?.content?.trim();
    return out || null;
  } catch {
    return null;
  }
}
