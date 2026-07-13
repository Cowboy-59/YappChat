"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spec 017 FR-019 — compact AI status + refresh control for a space header.
 *
 * Shows whether the per-space support AI is on and how its knowledge sources are
 * indexing; lets a moderator trigger a re-crawl. Read-only members still see the
 * "🤖 AI" indicator so it's clear the bot is answering from sources.
 */

type SourceStatus = "pending" | "indexing" | "ready" | "error";
type Source = { id: string; kind: "website" | "document" | "history"; title: string; url: string | null; status: SourceStatus; error: string | null };
type State = { config: { enabled: boolean; autoanswer: boolean; lastindexedat: string | null } | null; sources: Source[] };

export function SpaceAiPanel({
  communityId,
  spaceId,
  canModerate,
}: {
  communityId: string;
  spaceId: string;
  canModerate: boolean;
}) {
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/communities/${communityId}/spaces/${spaceId}/ai`, { credentials: "include" });
    if (r.ok) setState((await r.json()) as State);
  }, [communityId, spaceId]);

  // The parent remounts this per space (key={space.id}), so a one-time load on
  // mount is all that's needed — no cross-space state reset.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, [load]);

  // While anything is indexing, poll until it settles.
  useEffect(() => {
    const indexing = state?.sources.some((s) => s.status === "indexing" || s.status === "pending");
    if (!indexing) return;
    const t = setTimeout(() => void load(), 2500);
    return () => clearTimeout(t);
  }, [state, load]);

  async function refresh() {
    setBusy(true);
    try {
      await fetch(`/api/communities/${communityId}/spaces/${spaceId}/ai`, { method: "POST", credentials: "include" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  // FR-019 — upload a help/knowledge document; it is stored, chunked, embedded
  // into pgvector, and searched by the support bot. Status then polls to "ready".
  async function uploadDocument(file: File) {
    setUploading(true);
    setUploadNote(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch(`/api/communities/${communityId}/spaces/${spaceId}/ai/documents`, {
        method: "POST",
        credentials: "include",
        body,
      });
      if (r.ok) {
        setUploadNote(`Added “${file.name}” — indexing…`);
        await load();
      } else if (r.status === 413) {
        setUploadNote("File too large (max 20 MB).");
      } else if (r.status === 415) {
        setUploadNote("Use a PDF, DOCX, MD, TXT, or HTML file.");
      } else if (r.status === 503) {
        setUploadNote("Document storage isn’t configured.");
      } else {
        setUploadNote("Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }

  if (!state?.config?.enabled) return null;

  const sources = state.sources;
  const indexing = sources.some((s) => s.status === "indexing" || s.status === "pending");
  const errored = sources.filter((s) => s.status === "error").length;
  const dot = indexing ? "bg-amber-500" : errored ? "bg-destructive" : "bg-emerald-500";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs hover:bg-muted"
        title="Space AI assistant"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        🤖 AI
        {indexing && <span className="text-muted-foreground">indexing…</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Support AI</span>
            {canModerate && (
              <button onClick={refresh} disabled={busy || indexing} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                {busy ? "…" : "Refresh"}
              </button>
            )}
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {state.config.autoanswer ? "Auto-answers questions" : "Answers when asked"} from these sources only:
          </p>
          <ul className="space-y-1">
            {sources.length === 0 && <li className="text-xs text-muted-foreground">No sources configured.</li>}
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-xs">
                <span className="shrink-0">{s.kind === "website" ? "🌐" : s.kind === "document" ? "📄" : "💬"}</span>
                <span className="min-w-0 flex-1 truncate" title={s.url ?? s.title}>
                  {s.kind === "history" ? "Space history" : s.title || s.url}
                </span>
                <StatusPill status={s.status} title={s.error ?? undefined} />
              </li>
            ))}
          </ul>

          {canModerate && (
            <div className="mt-2 border-t border-border pt-2">
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.md,.txt,.html"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDocument(f);
                  e.target.value = ""; // allow re-selecting the same file
                }}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="w-full rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "+ Add document (PDF, DOCX, MD, TXT)"}
              </button>
              {uploadNote && <p className="mt-1 text-[11px] text-muted-foreground">{uploadNote}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, title }: { status: SourceStatus; title?: string }) {
  const map: Record<SourceStatus, string> = {
    ready: "text-emerald-600 dark:text-emerald-400",
    indexing: "text-amber-600 dark:text-amber-400",
    pending: "text-muted-foreground",
    error: "text-destructive",
  };
  return (
    <span className={`shrink-0 ${map[status]}`} title={title}>
      {status}
    </span>
  );
}
