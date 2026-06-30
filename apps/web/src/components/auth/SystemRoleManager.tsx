"use client";

import { useEffect, useState } from "react";

/**
 * Spec 011 T008 — manage the three system-level flags. Visible to issystemadmin
 * or issupport; only issystemadmin can toggle (the API enforces this too). Lists
 * users that already hold a flag — granting a flag to a brand-new user is done
 * via the Admin console (spec 013) / bootstrap.
 */
type FlaggedUser = {
  id: string;
  email: string;
  displayname: string;
  issystemadmin: boolean;
  isbillingadmin: boolean;
  issupport: boolean;
};

const FLAGS = [
  { key: "issystemadmin", label: "System admin" },
  { key: "isbillingadmin", label: "Billing admin" },
  { key: "issupport", label: "Support" },
] as const;

export function SystemRoleManager({ canEdit }: { canEdit: boolean }) {
  const [users, setUsers] = useState<FlaggedUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/auth/system-roles", { credentials: "include" });
    if (r.ok) setUsers(((await r.json()) as { users: FlaggedUser[] }).users);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, []);

  async function toggle(u: FlaggedUser, flag: (typeof FLAGS)[number]["key"]) {
    setBusy(`${u.id}:${flag}`);
    const r = await fetch(`/api/auth/system-roles/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ [flag]: !u[flag] }),
    });
    setBusy(null);
    if (r.ok) void load();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold">System roles</h2>
      {users === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground">No users hold a system flag.</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-lg border border-border px-3 py-2">
              <div className="text-sm font-medium">{u.displayname}</div>
              <div className="truncate text-xs text-muted-foreground">{u.email}</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {FLAGS.map((f) => (
                  <label key={f.key} className="inline-flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={u[f.key]}
                      disabled={!canEdit || busy === `${u.id}:${f.key}`}
                      onChange={() => toggle(u, f.key)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
