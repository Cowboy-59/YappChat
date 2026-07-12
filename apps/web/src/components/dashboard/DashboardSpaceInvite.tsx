"use client";

import { useState } from "react";

/**
 * Spec 068 delta / 017 FR-021 — "Invite to a space" on the dashboard. For a
 * community owner/moderator (e.g. wxKanban) to generate a shareable link into a
 * specific space — its Public or Support chat — without digging into the community
 * Manage panel. Community-wide invite = "Whole community" (no space). Reuses the
 * FR-021 endpoints; admin/corp-only spaces are single-use (reusable options hidden).
 */

export type InviteTargetCommunity = { id: string; name: string; spaces: Array<{ id: string; name: string; reusable: boolean }> };

const field = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm";
const btn = "inline-flex min-h-[36px] items-center justify-center gap-1 rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50`;
const ghost = `${btn} border border-border hover:bg-muted disabled:opacity-50`;

const USES: { label: string; maxuses: number | null | undefined }[] = [
  { label: "Single-use", maxuses: undefined },
  { label: "25 uses", maxuses: 25 },
  { label: "100 uses", maxuses: 100 },
  { label: "Unlimited", maxuses: null },
];

export function DashboardSpaceInvite({ targets }: { targets: InviteTargetCommunity[] }) {
  const [communityid, setCommunityid] = useState(targets[0]?.id ?? "");
  const [spaceid, setSpaceid] = useState(""); // "" = whole community
  const [uses, setUses] = useState(0);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const community = targets.find((c) => c.id === communityid);
  const space = community?.spaces.find((s) => s.id === spaceid);
  // Community-wide (no space) is always reusable; a space is reusable unless admin/corp-only.
  const reusable = spaceid === "" || (space?.reusable ?? false);

  async function create() {
    if (!communityid) return;
    setBusy(true);
    setLink(null);
    try {
      const maxuses = reusable ? USES[uses].maxuses : undefined;
      const url = spaceid
        ? `/api/communities/${communityid}/spaces/${spaceid}/invites`
        : `/api/communities/${communityid}/invites`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ttlHours: 72, ...(maxuses !== undefined ? { maxuses } : {}) }),
      });
      if (r.ok) {
        const { invite } = await r.json();
        setLink(`${window.location.origin}/communities/join?token=${encodeURIComponent(invite.token)}`);
        setCopied(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-bold">Invite users to a space</h2>
        <p className="text-xs text-muted-foreground">Share a link into a community space (e.g. your Public or Support chat).</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Community"
          className={`${field} w-auto`}
          value={communityid}
          onChange={(e) => {
            setCommunityid(e.target.value);
            setSpaceid("");
            setLink(null);
          }}
        >
          {targets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Space"
          className={`${field} w-auto`}
          value={spaceid}
          onChange={(e) => {
            setSpaceid(e.target.value);
            setLink(null);
          }}
        >
          <option value="">Whole community</option>
          {(community?.spaces ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.reusable ? "" : " (single-use only)"}
            </option>
          ))}
        </select>

        {reusable && (
          <select aria-label="Number of uses" className={`${field} w-auto`} value={uses} onChange={(e) => setUses(Number(e.target.value))}>
            {USES.map((u, i) => (
              <option key={u.label} value={i}>
                {u.label}
              </option>
            ))}
          </select>
        )}

        <button type="button" onClick={create} disabled={busy || !communityid} className={primary}>
          {busy ? "…" : "Create link"}
        </button>
      </div>

      {link && (
        <div className="flex items-center gap-2">
          <input aria-label="Invite link" readOnly className={field} value={link} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className={ghost}
            onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {})}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </section>
  );
}
