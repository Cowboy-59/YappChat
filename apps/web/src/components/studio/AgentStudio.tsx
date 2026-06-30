"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Skill = { id: string; name: string; label: string; enabled: boolean };
type Agent = {
  id: string;
  name: string;
  description: string;
  systemprompt: string;
  async: boolean;
  enabled: boolean;
  maxruntimeseconds: number;
  skillids: string[];
};

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const btn = "inline-flex min-h-[38px] items-center justify-center rounded-lg px-4 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;

const blank = () => ({ name: "", description: "", systemprompt: "", async: false, maxruntimeseconds: 600, skillids: [] as string[] });

export function AgentStudio() {
  const [agents, setAgents] = useState<Array<Agent & { skillcount?: number }>>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(blank());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      fetch("/api/studio/agents", { credentials: "include" }),
      fetch("/api/studio/skills?enabled=true", { credentials: "include" }),
    ]);
    if (a.ok) setAgents((await a.json()).agents);
    if (s.ok) setSkills((await s.json()).skills);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async load: setState runs after await
  useEffect(() => { void load(); }, [load]);

  function startCreate() { setCreating(true); setSelected(null); setDraft(blank()); setError(null); }
  function select(a: Agent) { setCreating(false); setSelected(a); setDraft({ ...a }); setError(null); }

  async function save() {
    setError(null);
    const url = creating ? "/api/studio/agents" : `/api/studio/agents/${selected!.id}`;
    const res = await fetch(url, {
      method: creating ? "POST" : "PATCH",
      headers: { "content-type": "application/json" }, credentials: "include",
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error === "name_taken" ? "A template with that name already exists."
        : data.error === "template_contains_disabled_skills" ? "Remove disabled skills before saving."
        : data.error ?? "Save failed");
      return;
    }
    await load();
    if (data.agent) { setSelected(data.agent); setCreating(false); }
  }

  async function toggle(a: Agent) {
    const res = await fetch(`/api/studio/agents/${a.id}/${a.enabled ? "disable" : "enable"}`, { method: "PATCH", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error === "template_contains_disabled_skills" ? "Can't enable: contains disabled skills." : data.error ?? "Failed"); return; }
    await load();
    if (selected?.id === a.id) setSelected({ ...a, enabled: !a.enabled });
  }

  function toggleSkill(id: string) {
    setDraft({ ...draft, skillids: draft.skillids.includes(id) ? draft.skillids.filter((x) => x !== id) : [...draft.skillids, id] });
  }

  return (
    <div className="flex min-h-[70vh] gap-6">
      <aside className="w-72 shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Agent templates</h2>
          <button onClick={startCreate} className={primary}>New</button>
        </div>
        <div className="space-y-1">
          {agents.map((a) => (
            <button key={a.id} onClick={() => select(a)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${selected?.id === a.id ? "border-primary bg-muted" : "border-border hover:bg-muted"}`}>
              <span className="truncate font-medium">{a.name}</span>
              <span className="ml-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{a.skillcount ?? a.skillids?.length ?? 0} skills</span>
                <span className={`h-2 w-2 rounded-full ${a.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              </span>
            </button>
          ))}
          {agents.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">No templates yet.</p>}
        </div>
        <Link href="/studio" className="mt-4 inline-block text-sm text-primary hover:underline">← Skills</Link>
      </aside>

      <section className="flex-1 rounded-xl border border-border bg-card p-6">
        {!creating && !selected ? (
          <p className="text-sm text-muted-foreground">Select a template or create one.</p>
        ) : (
          <div className="space-y-4">
            {!creating && selected && (
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">{selected.enabled ? "Enabled" : "Disabled"}</span>
                <button onClick={() => toggle(selected)} className={ghost}>{selected.enabled ? "Disable" : "Enable"}</button>
              </div>
            )}
            {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Max runtime (s, 60–3600)</label>
                <input type="number" min={60} max={3600} className={field} value={draft.maxruntimeseconds} onChange={(e) => setDraft({ ...draft, maxruntimeseconds: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <input className={field} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">System prompt</label>
              <textarea className={field} rows={5} value={draft.systemprompt} onChange={(e) => setDraft({ ...draft, systemprompt: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.async} onChange={(e) => setDraft({ ...draft, async: e.target.checked })} /> Asynchronous
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium">Skills (enabled only)</label>
              <div className="space-y-1 rounded-lg border border-border bg-background p-3">
                {skills.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={draft.skillids.includes(s.id)} onChange={() => toggleSkill(s.id)} />
                    {s.label || s.name}
                  </label>
                ))}
                {skills.length === 0 && <p className="text-xs text-muted-foreground">No enabled skills. Enable a skill first.</p>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Provider selection (spec 002 aiproviders) lands when spec 002 is built.</p>
            </div>
            <button onClick={save} className={primary}>{creating ? "Create template (disabled)" : "Save changes"}</button>
          </div>
        )}
      </section>
    </div>
  );
}
