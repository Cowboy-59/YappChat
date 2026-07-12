"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Spec 013 FR-019 — Global invite console (system admin). One surface over BOTH
 * invite systems: company/org invites (011) and community/space links (017, incl.
 * FR-021 reusable). List + type filter + create (any company/community/space) +
 * revoke. Reads/mutates only `/api/admin/invites*` (system-admin gated server-side).
 */

type AdminInvite = {
  source: "org" | "community";
  type: "company" | "community" | "space";
  id: string;
  target: string;
  invitedbyemail: string | null;
  email: string | null;
  usecount: number | null;
  maxuses: number | null;
  remaining: number | null;
  expiresat: string;
};
type Targets = {
  orgs: { id: string; name: string }[];
  communities: { id: string; name: string; spaces: { id: string; name: string; reusable: boolean }[] }[];
};

const field = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm";
const btn = "inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50`;
const ghost = `${btn} border border-border hover:bg-muted disabled:opacity-50`;

const USES: { label: string; maxuses: number | null | undefined }[] = [
  { label: "Single-use", maxuses: undefined },
  { label: "25 uses", maxuses: 25 },
  { label: "100 uses", maxuses: 100 },
  { label: "Unlimited", maxuses: null },
];

function usesLabel(i: AdminInvite): string {
  if (i.type === "company") return "Email · single-use";
  if (i.maxuses == null) return `Unlimited · ${i.usecount ?? 0} used`;
  if (i.maxuses === 1) return "Single-use";
  return `${i.remaining ?? 0} of ${i.maxuses} left`;
}

export function InviteConsole() {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [targets, setTargets] = useState<Targets>({ orgs: [], communities: [] });
  const [typeFilter, setTypeFilter] = useState("");
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (q.trim()) params.set("q", q.trim());
    const r = await fetch(`/api/admin/invites?${params.toString()}`, { credentials: "include" });
    if (r.ok) setInvites((await r.json()).invites ?? []);
  }, [typeFilter, q]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (q.trim()) params.set("q", q.trim());
    void (async () => {
      const r = await fetch(`/api/admin/invites?${params.toString()}`, { credentials: "include" });
      if (r.ok && !cancelled) setInvites((await r.json()).invites ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [typeFilter, q]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetch(`/api/admin/invites/targets`, { credentials: "include" });
      if (r.ok && !cancelled) setTargets(await r.json());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function revoke(inv: AdminInvite) {
    const r = await fetch(`/api/admin/invites/${inv.source}/${inv.id}/revoke`, { method: "POST", credentials: "include" });
    if (r.ok) setInvites((prev) => prev.filter((i) => i.id !== inv.id));
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 text-card-foreground">
      <div>
        <h2 className="text-lg font-bold">Invite console</h2>
        <p className="text-sm text-muted-foreground">All active invites across companies and communities.</p>
      </div>

      <CreateInviteForm
        targets={targets}
        onCreated={(msg) => {
          setNote(msg);
          void load();
        }}
      />
      {note && (
        <p role="status" aria-live="polite" className="rounded-lg bg-muted px-3 py-2 text-xs">
          {note}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by invite type" className={`${field} w-auto`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="company">Company</option>
          <option value="community">Community</option>
          <option value="space">Space</option>
        </select>
        <input
          aria-label="Search invites by target or email"
          className={`${field} w-56`}
          placeholder="Search target / email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-3">Type</th>
              <th className="py-1.5 pr-3">Target</th>
              <th className="py-1.5 pr-3">Recipient / uses</th>
              <th className="py-1.5 pr-3">Invited by</th>
              <th className="py-1.5 pr-3">Expires</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => (
              <tr key={`${i.source}-${i.id}`} className="border-t border-border">
                <td className="py-1.5 pr-3">
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{i.type}</span>
                </td>
                <td className="py-1.5 pr-3">{i.target}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{i.email ?? usesLabel(i)}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{i.invitedbyemail ?? "—"}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{new Date(i.expiresat).toLocaleDateString()}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    aria-label={`Revoke ${i.type} invite to ${i.target}`}
                    onClick={() => {
                      if (window.confirm(`Revoke this ${i.type} invite to "${i.target}"? Any unused link stops working immediately.`)) void revoke(i);
                    }}
                    className="rounded font-semibold text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-sm text-muted-foreground">
                  No active invites.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreateInviteForm({ targets, onCreated }: { targets: Targets; onCreated: (msg: string) => void }) {
  const [type, setType] = useState<"company" | "community" | "space">("company");
  const [orgid, setOrgid] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [communityid, setCommunityid] = useState("");
  const [spaceid, setSpaceid] = useState("");
  const [uses, setUses] = useState(0);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const community = targets.communities.find((c) => c.id === communityid);
  const space = community?.spaces.find((s) => s.id === spaceid);
  const reusable = type === "community" || (type === "space" && (space?.reusable ?? false));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLink(null);
    try {
      const maxuses = reusable ? USES[uses].maxuses : undefined;
      let body: Record<string, unknown>;
      if (type === "company") body = { type, orgid, email: email.trim(), role };
      else if (type === "community") body = { type, communityid, ...(maxuses !== undefined ? { maxuses } : {}) };
      else body = { type, communityid, spaceid, ...(maxuses !== undefined ? { maxuses } : {}) };

      const r = await fetch(`/api/admin/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await r.json().catch(() => ({}))) as { result?: { kind: string; email?: string; token?: string }; error?: string };
      if (!r.ok) {
        onCreated(`Failed: ${data.error ?? r.status}`);
        return;
      }
      if (data.result?.kind === "company") {
        onCreated(`Invite emailed to ${data.result.email}.`);
        setEmail("");
      } else if (data.result?.token) {
        const url = `${window.location.origin}/communities/join?token=${encodeURIComponent(data.result.token)}`;
        setLink(url);
        onCreated("Invite link created.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Invite type" className={`${field} w-auto`} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="company">Into a company</option>
          <option value="community">Into a community</option>
          <option value="space">Into a space</option>
        </select>

        {type === "company" ? (
          <>
            <select aria-label="Company" className={`${field} w-auto`} value={orgid} onChange={(e) => setOrgid(e.target.value)} required>
              <option value="">Select company…</option>
              {targets.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Colleague email"
              autoComplete="email"
              className={`${field} w-56`}
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select aria-label="Role" className={`${field} w-auto`} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </>
        ) : (
          <>
            <select
              aria-label="Community"
              className={`${field} w-auto`}
              value={communityid}
              onChange={(e) => {
                setCommunityid(e.target.value);
                setSpaceid("");
              }}
              required
            >
              <option value="">Select community…</option>
              {targets.communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {type === "space" && (
              <select aria-label="Space" className={`${field} w-auto`} value={spaceid} onChange={(e) => setSpaceid(e.target.value)} required>
                <option value="">Select space…</option>
                {(community?.spaces ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.reusable ? "" : " (single-use only)"}
                  </option>
                ))}
              </select>
            )}
            {reusable && (
              <select aria-label="Number of uses" className={`${field} w-auto`} value={uses} onChange={(e) => setUses(Number(e.target.value))}>
                {USES.map((u, i) => (
                  <option key={u.label} value={i}>
                    {u.label}
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        <button type="submit" disabled={busy} className={primary}>
          {busy ? "…" : "Create invite"}
        </button>
      </div>
      {link && (
        <div className="flex items-center gap-2">
          <input aria-label="Invite link" readOnly className={field} value={link} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className={ghost} onClick={() => void navigator.clipboard?.writeText(link).catch(() => {})}>
            Copy
          </button>
        </div>
      )}
    </form>
  );
}
