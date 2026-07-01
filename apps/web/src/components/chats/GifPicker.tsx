"use client";

import { useEffect, useState } from "react";

type GifItem = { id: string; title: string; preview: string; url: string };

/**
 * GIF picker (spec 018 FR-009). Searches Giphy via the backend proxy
 * (/api/gifs/search — key stays server-side); calls onPick with the chosen GIF's
 * URL, which the caller re-hosts + sends. Empty query shows trending.
 */
export function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GifItem[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      setNote("");
      try {
        const r = await fetch(`/api/gifs/search?q=${encodeURIComponent(q.trim())}`, { credentials: "include" });
        if (r.status === 503) {
          setResults([]);
          setNote("GIF search isn't configured yet.");
          return;
        }
        if (!r.ok) {
          setResults([]);
          setNote("Couldn't load GIFs — try again.");
          return;
        }
        setResults(((await r.json()) as { results: GifItem[] }).results);
      } catch {
        setNote("Couldn't load GIFs — try again.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="absolute bottom-12 left-3 z-10 flex h-80 w-80 flex-col rounded-xl border border-border bg-card p-2 shadow-lg">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search GIFs…"
          className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted">
          Close
        </button>
      </div>
      {note && <p className="px-1 py-2 text-xs text-muted-foreground">{note}</p>}
      <div className="grid flex-1 grid-cols-2 gap-1.5 overflow-y-auto">
        {results.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onPick(g.url)}
            title={g.title}
            className="overflow-hidden rounded-lg border border-border hover:opacity-80"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Giphy preview thumbnail */}
            <img src={g.preview} alt={g.title} className="h-24 w-full object-cover" loading="lazy" />
          </button>
        ))}
        {!loading && !note && results.length === 0 && <p className="col-span-2 px-1 py-2 text-xs text-muted-foreground">No GIFs found.</p>}
      </div>
      <p className="pt-1 text-center text-[10px] text-muted-foreground">Powered by GIPHY</p>
    </div>
  );
}
