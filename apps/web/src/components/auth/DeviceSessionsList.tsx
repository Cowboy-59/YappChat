"use client";

import { useEffect, useState } from "react";

/** Spec 011 T008 (FR-014) — the caller's active sessions with per-row Revoke. */
type ActiveSession = {
  id: string;
  deviceid: string | null;
  ip: string | null;
  useragent: string | null;
  createdat: string;
  lastusedat: string;
  current: boolean;
};

/** Best-effort short label from a user-agent string (no dependency). */
function deviceSummary(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

export function DeviceSessionsList() {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/auth/sessions", { credentials: "include" });
    if (r.ok) setSessions(((await r.json()) as { sessions: ActiveSession[] }).sessions);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, []);

  async function revoke(id: string, current: boolean) {
    setBusy(id);
    const r = await fetch(`/api/auth/sessions/${id}/revoke`, { method: "POST", credentials: "include" });
    setBusy(null);
    if (current) {
      window.location.assign("/"); // revoked our own session → drop to landing
      return;
    }
    if (r.ok) void load();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold">Active sessions</h2>
      {sessions === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active sessions.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{deviceSummary(s.useragent)}</span>
                  {s.current && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      This device
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.ip ?? "IP hidden"} · last used {new Date(s.lastusedat).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revoke(s.id, s.current)}
                disabled={busy === s.id}
                className="shrink-0 rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy === s.id ? "…" : s.current ? "Sign out" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
