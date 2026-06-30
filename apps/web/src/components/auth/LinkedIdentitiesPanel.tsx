"use client";

import { useEffect, useState } from "react";

/** Spec 011 T008 (FR-018) — view/link/unlink SSO providers on the account. */
type Identity = { id: string; provider: string; email: string | null; createdat: string };
type Provider = { key: string; label: string };
type Payload = { identities: Identity[]; hasPassword: boolean; available: Provider[] };

const PROVIDER_LABEL: Record<string, string> = { google: "Google", microsoft: "Microsoft", oidc: "SSO" };

export function LinkedIdentitiesPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Seed the notice from a just-completed link redirect (?linked / ?link_error).
  const [note, setNote] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("linked")) return "Provider linked.";
    if (params.get("link_error") === "sso_identity_taken")
      return "That provider account is already linked to a different user.";
    if (params.get("link_error")) return "Couldn't link that provider.";
    return null;
  });

  async function load() {
    const r = await fetch("/api/auth/sso/identities", { credentials: "include" });
    if (r.ok) setData((await r.json()) as Payload);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, []);

  async function unlink(id: string) {
    setBusy(id);
    setNote(null);
    const r = await fetch(`/api/auth/sso/identities/${id}`, { method: "DELETE", credentials: "include" });
    setBusy(null);
    if (r.ok) void load();
    else if (r.status === 422) setNote("You can't remove your only sign-in method. Set a password first.");
    else setNote("Couldn't unlink that provider.");
  }

  const identities = data?.identities ?? [];
  // Last sign-in method: no password AND exactly one linked identity.
  const lastMethod = data ? !data.hasPassword && identities.length <= 1 : false;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Connected sign-in providers</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>

      {data === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          {identities.length === 0 ? (
            <p className="text-xs text-muted-foreground">No providers linked.</p>
          ) : (
            <ul className="space-y-2">
              {identities.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{PROVIDER_LABEL[i.provider] ?? i.provider}</div>
                    {i.email && <div className="truncate text-xs text-muted-foreground">{i.email}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => unlink(i.id)}
                    disabled={busy === i.id || lastMethod}
                    title={lastMethod ? "Set a password before removing your only sign-in method" : undefined}
                    className="shrink-0 rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {busy === i.id ? "…" : "Unlink"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {data.available.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {data.available.map((p) => (
                <a
                  key={p.key}
                  href={`/api/auth/sso/${p.key}?intent=link&return=${encodeURIComponent("/app")}`}
                  className="inline-flex min-h-[32px] items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
                >
                  Connect {p.label}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
