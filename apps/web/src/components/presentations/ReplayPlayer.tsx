"use client";

import { useEffect, useState } from "react";

/** Spec 071 T009 — access-scoped replay player (FR-019). */
export function ReplayPlayer({ presentationId }: { presentationId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "processing" | "ready" | "none">("loading");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const r = await fetch(`/api/presentations/${presentationId}/recording`, { credentials: "include" });
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
  }, [presentationId]);

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
        No recording available for this presentation.
      </div>
    );
  }
  // Seek to the first frame on load so the player shows a still preview (poster)
  // instead of a black box — visibly "ready to play".
  return (
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
    />
  );
}
