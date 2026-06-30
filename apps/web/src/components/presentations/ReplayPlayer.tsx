"use client";

import { useEffect, useState } from "react";

/** Spec 071 T009 — access-scoped replay player (FR-019). */
export function ReplayPlayer({ presentationId }: { presentationId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    let active = true;
    fetch(`/api/presentations/${presentationId}/recording`, { credentials: "include" })
      .then(async (r) => {
        if (!active) return;
        if (!r.ok) return setState("none");
        const { playbackUrl } = (await r.json()) as { playbackUrl: string | null };
        if (playbackUrl) {
          setUrl(playbackUrl);
          setState("ready");
        } else {
          setState("none");
        }
      })
      .catch(() => active && setState("none"));
    return () => {
      active = false;
    };
  }, [presentationId]);

  if (state === "loading") {
    return <div className="aspect-video rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading replay…</div>;
  }
  if (state === "none" || !url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        No recording available for this presentation.
      </div>
    );
  }
  return <video src={url} controls className="aspect-video w-full rounded-xl border border-border bg-black" />;
}
