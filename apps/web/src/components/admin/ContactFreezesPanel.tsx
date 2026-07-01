"use client";

import { useEffect, useState } from "react";

/**
 * Spec 018 delta §5 (FR-018-77) — sysadmin review + unfreeze surface for
 * contact-request flood freezes. System-admin only (the API re-verifies too).
 */
type Freeze = {
  id: string;
  userid: string;
  email: string;
  displayname: string;
  reason: string;
  triggercount: number;
  triggerlimit: number;
  windowms: number;
  createdat: string;
};

export function ContactFreezesPanel() {
  const [freezes, setFreezes] = useState<Freeze[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/contact-freezes", { credentials: "include" });
    if (r.ok) setFreezes(((await r.json()) as { freezes: Freeze[] }).freezes);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, []);

  async function unfreeze(id: string) {
    setBusy(id);
    const r = await fetch(`/api/admin/contact-freezes/${id}/unfreeze`, {
      method: "POST",
      credentials: "include",
    });
    setBusy(null);
    if (r.ok) void load();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-left">
      <h2 className="text-sm font-bold">Contact-request freezes</h2>
      {freezes === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : freezes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No users are frozen.</p>
      ) : (
        <ul className="space-y-2">
          {freezes.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{f.displayname}</div>
                <div className="truncate text-xs text-muted-foreground">{f.email}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {f.reason} · tripped {f.triggercount}/{f.triggerlimit} per {Math.round(f.windowms / 1000)}s ·{" "}
                  {new Date(f.createdat).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => unfreeze(f.id)}
                disabled={busy === f.id}
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                {busy === f.id ? "Unfreezing…" : "Unfreeze"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
