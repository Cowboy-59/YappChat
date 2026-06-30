"use client";

import { useRef, useState } from "react";

/**
 * Spec 017 FR-019 — space creation with the optional per-space support AI.
 *
 * Captures the space name plus, when "Use AI in this space" is on, the knowledge
 * sources the support bot will answer from: a website to crawl, uploaded
 * documents, and/or the space's own history. Documents are uploaded to S3 here
 * (reusing /api/upload) so only their keys travel in the create payload.
 */

export type SpaceAiSource =
  | { kind: "website"; url: string }
  | { kind: "document"; storagekey: string; title?: string };

export type SpaceCreatePayload = {
  name: string;
  ai?: { enabled: true; autoanswer: boolean; includehistory: boolean; sources: SpaceAiSource[] };
};

const btn = "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50`;
const ghost = `${btn} border border-border hover:bg-muted`;
const field = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm";

export function SpaceCreateForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (payload: SpaceCreatePayload) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [website, setWebsite] = useState("");
  const [includeHistory, setIncludeHistory] = useState(false);
  const [autoAnswer, setAutoAnswer] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 20));
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setError(null);
    setBusy(true);
    try {
      let ai: SpaceCreatePayload["ai"] | undefined;
      if (useAi) {
        const sources: SpaceAiSource[] = [];
        if (website.trim()) sources.push({ kind: "website", url: website.trim() });
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          const r = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
          if (!r.ok) throw new Error(`Couldn't upload "${file.name}"`);
          const { key } = (await r.json()) as { key: string };
          sources.push({ kind: "document", storagekey: key, title: file.name });
        }
        ai = { enabled: true, autoanswer: autoAnswer, includehistory: includeHistory, sources };
      }
      await onSubmit({ name: trimmed, ai });
    } catch (e) {
      setError((e as Error).message || "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 space-y-2 rounded-lg border border-border bg-background p-2.5">
      <input
        autoFocus
        className={field}
        placeholder="Space name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !useAi) {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
        <span className="font-medium">Use AI in this space</span>
        <span className="text-xs text-muted-foreground">support bot</span>
      </label>

      {useAi && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
          <p className="text-xs text-muted-foreground">
            The assistant answers questions in this space using only the sources you provide.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium">Documentation website (optional)</label>
            <input
              className={field}
              type="url"
              placeholder="https://docs.example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Crawled once as a snapshot; you can refresh it later.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Documents (optional)</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={`${ghost} px-2 text-xs`} onClick={() => fileRef.current?.click()}>
                + Add files
              </button>
              <span className="text-[11px] text-muted-foreground">PDF, DOCX, Markdown, TXT</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.md,.markdown,.txt,.htm,.html"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={includeHistory} onChange={(e) => setIncludeHistory(e.target.checked)} />
            Also answer from this space&apos;s message history
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={autoAnswer} onChange={(e) => setAutoAnswer(e.target.checked)} />
            Auto-answer questions members post
          </label>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-1.5">
        <button onClick={() => void submit()} disabled={busy || !name.trim()} className={`${primary} flex-1`}>
          {busy ? "Creating…" : "Create space"}
        </button>
        <button onClick={onCancel} disabled={busy} className={ghost}>
          Cancel
        </button>
      </div>
    </div>
  );
}
