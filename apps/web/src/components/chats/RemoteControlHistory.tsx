"use client";

import { useCallback, useState } from "react";

/** Spec 088 FR-014 — a compact popover of this DM's past control sessions. */

type Row = {
  id: string;
  controlleruserid: string;
  hostuserid: string;
  status: string;
  startedat: string | null;
  endedat: string | null;
  endreason: string | null;
  createdat: string;
};

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function RemoteControlHistory({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  const toggle = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    const r = await fetch(`/api/dm/${conversationId}/control/sessions`, { credentials: "include" });
    if (r.ok) setRows((await r.json()).sessions as Row[]);
  }, [open, conversationId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        title="Control history"
        className="inline-flex min-h-[30px] items-center justify-center rounded-lg border border-border px-2 text-xs hover:bg-muted"
      >
        🕘
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 max-h-72 w-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">Control history</div>
          {rows === null && <p className="px-1 py-2 text-xs text-muted-foreground">Loading…</p>}
          {rows?.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">No control sessions yet.</p>}
          {rows?.map((s) => (
            <div key={s.id} className="rounded-lg px-1.5 py-1 text-xs hover:bg-muted">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{new Date(s.createdat).toLocaleString()}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{s.endreason ?? s.status}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {s.controlleruserid.slice(0, 8)}… → {s.hostuserid.slice(0, 8)}… · {duration(s.startedat, s.endedat)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
