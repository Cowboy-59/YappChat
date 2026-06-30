"use client";

import { useCallback, useEffect, useState } from "react";

type Provider = {
  id: string;
  name: string;
  type: string;
  baseurl: string;
  model: string;
  supportsstreaming: boolean;
  lastpinglatencyms: number | null;
};

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const btn = "inline-flex min-h-[36px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;

const blank = () => ({
  name: "",
  type: "openai-compatible",
  baseurl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apikey: "",
  supportstooluse: false,
  supportsstreaming: true,
});

export function ProviderManager({ onActiveChange }: { onActiveChange?: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      fetch("/api/pa/providers", { credentials: "include" }),
      fetch("/api/pa/config", { credentials: "include" }),
    ]);
    if (p.ok) setProviders((await p.json()).providers);
    if (c.ok) setActiveId((await c.json()).activeproviderid);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async load: setState after await
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setBusy(true); setStatus(null);
    try {
      const res = await fetch("/api/pa/providers", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus(data.error ?? "Failed to add"); return; }
      setStatus(data.connected ? `Connected ✓ (${data.latencyms}ms)` : `Saved, but ping failed: ${data.error ?? ""}`);
      setDraft(blank());
      await load();
    } finally { setBusy(false); }
  }

  async function ping(id: string) {
    setStatus("Pinging…");
    const res = await fetch(`/api/pa/providers/${id}/ping`, { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setStatus(data.connected ? `Connected ✓ (${data.latencyms}ms)` : `Ping failed: ${data.error ?? ""}`);
    await load();
  }

  async function makeActive(id: string) {
    await fetch("/api/pa/config", {
      method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include",
      body: JSON.stringify({ providerid: id }),
    });
    await load();
    onActiveChange?.();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/pa/providers/${id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setStatus(data.error === "provider_is_active" ? "Switch active provider before deleting." : data.error ?? "Delete failed");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-lg font-bold">Your AI providers</h3>
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-sm">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{p.type} · {p.model}</span>
                {activeId === p.id && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">active</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => ping(p.id)} className={ghost}>Test</button>
                {activeId !== p.id && <button onClick={() => makeActive(p.id)} className={ghost}>Use</button>}
                <button onClick={() => remove(p.id)} className={ghost}>Delete</button>
              </div>
            </div>
          ))}
          {providers.length === 0 && <p className="text-sm text-muted-foreground">No providers yet. Add one below.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-base font-bold">Add a provider</h3>
        {status && <p className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">{status}</p>}
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="Label (e.g. Work GPT)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className={field} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
            <option value="custom">Custom</option>
          </select>
          <input className={field} placeholder="Base URL" value={draft.baseurl} onChange={(e) => setDraft({ ...draft, baseurl: e.target.value })} />
          <input className={field} placeholder="Model (e.g. gpt-4o-mini)" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
          <input className={`${field} col-span-2`} type="password" placeholder="API key (stored server-side, never returned)" value={draft.apikey} onChange={(e) => setDraft({ ...draft, apikey: e.target.value })} />
        </div>
        <button onClick={add} disabled={busy} className={`${primary} mt-3`}>{busy ? "Adding…" : "Add & test"}</button>
      </div>
    </div>
  );
}
