"use client";

import { useEffect, useState } from "react";

/**
 * Spec 092 T005 (FR-007) — inline document viewer. Resolves the item's access-
 * scoped presigned URL and renders it inline; PDFs render in the browser's native
 * viewer (an <iframe> on the presigned object), matching how the space-AI pipeline
 * surfaces PDFs. Anything the browser can't render inline is offered as a download.
 */
export function DocumentViewer({ itemId }: { itemId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    let active = true;
    void (async () => {
      const r = await fetch(`/api/training/items/${itemId}/media`, { credentials: "include" });
      if (!active) return;
      if (r.ok) {
        const d = (await r.json()) as { status: string; playbackUrl: string | null };
        if (d.playbackUrl) {
          setUrl(d.playbackUrl);
          setState("ready");
          return;
        }
      }
      setState("none");
    })();
    return () => {
      active = false;
    };
  }, [itemId]);

  if (state === "loading") {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading document…</div>;
  }
  if (state === "none" || !url) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        This document isn&apos;t available.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <iframe src={url} title="Training document" className="h-[70vh] w-full rounded-xl border border-border bg-card" />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-[32px] items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
      >
        ⬇ Open / download
      </a>
    </div>
  );
}
