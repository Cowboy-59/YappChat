"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "owner" | "admin" | "member";
type Member = { userid: string; email: string; displayname: string; role: Role };
type Invite = { id: string; email: string; role: Role; expiresat: string };
type Data = {
  org: { id: string; name: string; plantype: string; role: Role };
  me: string;
  canManage: boolean;
  members: Member[];
  invites: Invite[];
};

const ERR: Record<string, string> = {
  already_member: "That person is already a member.",
  seat_limit_reached: "No seats available on this plan.",
  last_owner: "You can't remove or demote the last owner.",
  invalid_email: "Enter a valid email address.",
  email_required: "Enter an email address.",
};
const errText = (code?: string) => ERR[code ?? ""] ?? "Something went wrong.";

const roleBadge: Record<Role, string> = {
  owner: "bg-primary/15 text-primary",
  admin: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  member: "bg-muted text-muted-foreground",
};

export function MembersManager() {
  const [data, setData] = useState<Data | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/orgs/members", { credentials: "include" });
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const r = await fetch("/api/orgs/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email.trim(), role }),
    });
    setBusy(false);
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.ok) {
      setEmail("");
      setNote(`Invite sent to ${email.trim()}.`);
      void load();
    } else {
      setNote(errText(d.error));
    }
  }

  async function remove(uid: string) {
    if (!window.confirm("Remove this member from the workspace?")) return;
    const r = await fetch(`/api/orgs/members/${uid}`, { method: "DELETE", credentials: "include" });
    if (r.ok) void load();
    else setNote(errText(((await r.json().catch(() => ({}))) as { error?: string }).error));
  }

  async function changeRole(uid: string, newRole: Role) {
    const r = await fetch(`/api/orgs/members/${uid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: newRole }),
    });
    if (r.ok) void load();
    else setNote(errText(((await r.json().catch(() => ({}))) as { error?: string }).error));
  }

  async function revoke(id: string) {
    const r = await fetch(`/api/orgs/invitations/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) void load();
  }

  async function resend(id: string) {
    const r = await fetch(`/api/orgs/invitations/${id}`, { method: "POST", credentials: "include" });
    setNote(r.ok ? "Invite resent." : errText(((await r.json().catch(() => ({}))) as { error?: string }).error));
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading members…</p>;

  return (
    <div className="space-y-6">
      {/* Invite — owner/admin only */}
      {data.canManage && (
      <form onSubmit={invite} className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold">Invite a colleague</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "admin")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </form>
      )}

      {/* Members */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold">Members ({data.members.length})</h2>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.members.map((m) => (
            <div key={m.userid} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {m.displayname} {m.userid === data.me && <span className="text-xs text-muted-foreground">(you)</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {data.canManage ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.userid, e.target.value as Role)}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleBadge[m.role]}`}
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                    <button
                      onClick={() => remove(m.userid)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-red-600 hover:bg-muted dark:text-red-400"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${roleBadge[m.role]}`}>{m.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pending invites */}
      {data.invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">Pending invites ({data.invites.length})</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {data.invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.role} · expires {new Date(inv.expiresat).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => resend(inv.id)}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                  >
                    Resend
                  </button>
                  <button
                    onClick={() => revoke(inv.id)}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-red-600 hover:bg-muted dark:text-red-400"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
