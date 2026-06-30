"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Discoverable = {
  id: string;
  name: string;
  description: string;
  joinpolicy: "open" | "approval" | "invite";
  membercount: number;
  isMember: boolean;
  requested: boolean;
};

/** Spec 068 — compact public-community discovery on the dashboard. Full browse lives at /communities. */
export function DiscoverWidget() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Discoverable[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (query: string) => {
    const r = await fetch(`/api/communities/discover?q=${encodeURIComponent(query)}`, { credentials: "include" });
    if (r.ok) setResults(((await r.json()).communities as Discoverable[]).slice(0, 6));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void run("");
  }, [run]);

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(v), 250);
  }

  async function join(c: Discoverable) {
    setBusy(c.id);
    const r = await fetch(`/api/communities/${c.id}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    setBusy(null);
    if (!r.ok) return;
    const data = await r.json();
    await run(q);
    if (data.status === "member") router.refresh();
  }

  async function leave(c: Discoverable) {
    setBusy(c.id);
    const r = await fetch(`/api/communities/${c.id}/members/me`, { method: "DELETE", credentials: "include" });
    setBusy(null);
    if (!r.ok) return; // e.g. 409 last_owner — can't leave a community you solely own
    await run(q); // refreshes isMember → button flips back to Join
    router.refresh(); // drop it from "Your communities"
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold">Discover communities</h2>
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        placeholder="Search public communities…"
        value={q}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="space-y-1.5">
        {results.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {c.membercount} member{c.membercount === 1 ? "" : "s"}
              </div>
            </div>
            {c.isMember ? (
              <button
                onClick={() => leave(c)}
                disabled={busy === c.id}
                className="shrink-0 rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy === c.id ? "…" : "Leave"}
              </button>
            ) : c.requested ? (
              <span className="shrink-0 text-xs text-muted-foreground">Requested</span>
            ) : c.joinpolicy === "invite" ? (
              <span className="shrink-0 text-xs text-muted-foreground">Invite-only</span>
            ) : (
              <button
                onClick={() => join(c)}
                disabled={busy === c.id}
                className="shrink-0 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {c.joinpolicy === "approval" ? "Request" : "Join"}
              </button>
            )}
          </div>
        ))}
        {results.length === 0 && (
          <p className="px-1 py-3 text-xs text-muted-foreground">{q ? "No matches." : "No public communities yet."}</p>
        )}
      </div>
    </div>
  );
}
