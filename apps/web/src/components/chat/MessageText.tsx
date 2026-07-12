"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Spec 017 FR-012 — per-viewer message rendering with lazy auto-translation.
 *
 * When `translate` is on, the message shows in its ORIGINAL first, then swaps to
 * the viewer's language once the translation resolves (lazy render). Translation
 * is fetched once per message from POST /api/messages/:id/translate (server-side
 * cached, same-language = no-op). A "view original" toggle is always offered on a
 * translated message. When `translate` is off, or the message is same-language,
 * the original renders unchanged. `render` lets a caller post-process the text
 * (e.g. linkify) — it is applied to whichever variant is shown.
 */
export function MessageText({
  messageId,
  content,
  translate,
  render,
}: {
  messageId: string;
  content: string;
  translate: boolean;
  render?: (text: string) => ReactNode;
}) {
  const r = render ?? ((t: string) => t);
  const [translation, setTranslation] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!translate) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/messages/${messageId}/translate`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const d = (await res.json()) as { content: string; translated: boolean };
        // Only swap when the server actually translated (different language) and
        // the result differs from the original.
        if (!cancelled && d.translated && d.content && d.content !== content) {
          setTranslation(d.content);
        }
      } catch {
        /* leave the original on any failure — never block the message */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId, translate, content]);

  if (translation == null) return <>{r(content)}</>;

  return (
    <>
      {r(showOriginal ? content : translation)}
      <button
        type="button"
        onClick={() => setShowOriginal((v) => !v)}
        className="ml-1 align-baseline text-[10px] font-medium underline opacity-60 hover:opacity-100"
      >
        {showOriginal ? "show translation" : "view original"}
      </button>
    </>
  );
}
