"use client";

import { useEffect, useState } from "react";
import { SUPPORTED_LANGUAGES } from "@/lib/account/languages";

/**
 * Spec 071 T009 — access-scoped replay player (FR-019).
 *
 * Endpoint-driven so it can be reused verbatim by spec 092 Training (FR-004) for
 * both recording-reference and uploaded-video items — no second player. Pass a
 * `presentationId` for the default spec-071 endpoints, or explicit
 * `recordingEndpoint`/`shareEndpoint` (+ `captionsBase: null` to omit captions)
 * for any other source that returns the same `{ status, playbackUrl }` shape.
 */
export function ReplayPlayer({
  presentationId,
  recordingEndpoint,
  shareEndpoint,
  captionsBase,
}: {
  presentationId?: string;
  recordingEndpoint?: string;
  shareEndpoint?: string;
  captionsBase?: string | null;
}) {
  const recEndpoint = recordingEndpoint ?? `/api/presentations/${presentationId}/recording`;
  const shrEndpoint = shareEndpoint ?? `/api/presentations/${presentationId}/recording/share`;
  // Default captions come from the spec-071 presentation; explicit null disables them.
  const capBase =
    captionsBase === undefined ? (presentationId ? `/api/presentations/${presentationId}/captions/vtt` : null) : captionsBase;

  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "processing" | "ready" | "none">("loading");
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // A 7-day shareable/download link to the S3 object (for sending or pasting elsewhere).
  async function fetchShareUrl(): Promise<string | null> {
    const r = await fetch(shrEndpoint, { credentials: "include" });
    if (!r.ok) return null;
    const d = (await r.json()) as { url: string | null };
    return d.url;
  }
  async function copyLink() {
    setShareBusy(true);
    const u = await fetchShareUrl();
    setShareBusy(false);
    if (!u) return;
    try {
      await navigator.clipboard.writeText(u);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this video link:", u);
    }
  }
  async function download() {
    setShareBusy(true);
    const u = await fetchShareUrl();
    setShareBusy(false);
    if (u) window.open(u, "_blank");
  }

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const r = await fetch(recEndpoint, { credentials: "include" });
        if (!active) return;
        if (!r.ok) return setState("none");
        const d = (await r.json()) as { status?: "ready" | "processing" | "none"; playbackUrl: string | null };
        if (d.status === "ready" && d.playbackUrl) {
          setUrl(d.playbackUrl);
          setState("ready");
        } else if (d.status === "processing") {
          // Egress is still finalizing/uploading — keep polling.
          setState("processing");
          timer = setTimeout(() => void poll(), 5000);
        } else {
          setState("none");
        }
      } catch {
        if (active) {
          setState("processing");
          timer = setTimeout(() => void poll(), 5000);
        }
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [recEndpoint]);

  if (state === "loading") {
    return <div className="aspect-video rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading replay…</div>;
  }
  if (state === "processing") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <div className="text-sm font-medium text-foreground">Processing recording…</div>
        <div className="max-w-xs text-xs text-muted-foreground">
          The video is being rendered and uploaded — this can take up to a minute or two after the presentation ends. This page updates automatically.
        </div>
      </div>
    );
  }
  if (state === "none" || !url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        No recording available.
      </div>
    );
  }
  // Seek to the first frame on load so the player shows a still preview (poster)
  // instead of a black box — visibly "ready to play".
  return (
    <div className="space-y-2">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.currentTime === 0) {
            try {
              v.currentTime = 0.1;
            } catch {
              /* some browsers disallow seeking before play; harmless */
            }
          }
        }}
        className="aspect-video w-full rounded-xl border border-border bg-black"
      >
        {/* Soft captions built from the saved transcript. Default English; the
            player's CC menu switches language (others translate on demand). */}
        {capBase &&
          SUPPORTED_LANGUAGES.map((l) => (
            <track
              key={l.code}
              kind="subtitles"
              srcLang={l.code}
              label={l.label}
              default={l.code === "en"}
              src={`${capBase}?lang=${l.code}`}
            />
          ))}
      </video>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copyLink}
          disabled={shareBusy}
          className="inline-flex min-h-[32px] items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          title="Copy a 7-day shareable link to the video (for email, wxKanban, etc.)"
        >
          {copied ? "Link copied ✓" : shareBusy ? "Working…" : "🔗 Copy video link"}
        </button>
        <button
          onClick={download}
          disabled={shareBusy}
          className="inline-flex min-h-[32px] items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          title="Download the file"
        >
          ⬇ Download
        </button>
        <span className="text-[11px] text-muted-foreground">Link works for 7 days.</span>
      </div>
    </div>
  );
}
