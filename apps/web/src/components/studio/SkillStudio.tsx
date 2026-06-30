"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { JSONSchemaEditor } from "./JSONSchemaEditor";
import { SKILL_CATEGORIES } from "@/lib/studio/skill-schema";

type Skill = {
  id: string;
  name: string;
  label: string;
  description: string;
  category: string;
  inputschema: unknown;
  handlerurl: string;
  async: boolean;
  enabled: boolean;
  version: string;
};

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const btn = "inline-flex min-h-[38px] items-center justify-center rounded-lg px-4 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;

const blankDraft = () => ({
  name: "",
  label: "",
  description: "",
  category: "custom",
  inputschema: { type: "object", properties: {} } as unknown,
  handlerurl: "",
  async: false,
});

export function SkillStudio() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(blankDraft());
  const [tab, setTab] = useState<"edit" | "test" | "code" | "versions">("edit");
  const [error, setError] = useState<string | null>(null);
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/studio/skills", { credentials: "include" });
    if (res.ok) setSkills((await res.json()).skills);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async load: setState runs after await
  useEffect(() => { void load(); }, [load]);

  function startCreate() {
    setCreating(true);
    setSelected(null);
    setDraft(blankDraft());
    setTab("edit");
    setError(null);
    setTokenOnce(null);
  }

  function select(s: Skill) {
    setCreating(false);
    setSelected(s);
    setDraft({ ...s });
    setTab("edit");
    setError(null);
    setTokenOnce(null);
  }

  async function save() {
    setError(null);
    const url = creating ? "/api/studio/skills" : `/api/studio/skills/${selected!.id}`;
    const res = await fetch(url, {
      method: creating ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error === "name_taken" ? "A skill with that name already exists." : data.error ?? "Save failed");
      return;
    }
    if (creating && data.skilltoken) setTokenOnce(data.skilltoken);
    await load();
    if (data.skill) { setSelected(data.skill); setCreating(false); }
  }

  async function toggleEnabled(s: Skill) {
    await fetch(`/api/studio/skills/${s.id}/${s.enabled ? "disable" : "enable"}`, {
      method: "PATCH",
      credentials: "include",
    });
    await load();
    if (selected?.id === s.id) setSelected({ ...s, enabled: !s.enabled });
  }

  return (
    <div className="flex min-h-[70vh] gap-6">
      {/* Sidebar */}
      <aside className="w-72 shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Skills</h2>
          <button onClick={startCreate} className={primary}>New</button>
        </div>
        <div className="space-y-1">
          {skills.map((s) => (
            <button
              key={s.id}
              onClick={() => select(s)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${selected?.id === s.id ? "border-primary bg-muted" : "border-border hover:bg-muted"}`}
            >
              <span className="truncate">
                <span className="font-medium">{s.label || s.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{s.category}</span>
              </span>
              <span className={`ml-2 h-2 w-2 shrink-0 rounded-full ${s.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
            </button>
          ))}
          {skills.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">No skills yet. Create one.</p>}
        </div>
        <Link href="/studio/agents" className="mt-4 inline-block text-sm text-primary hover:underline">
          → Agent templates
        </Link>
      </aside>

      {/* Detail */}
      <section className="flex-1 rounded-xl border border-border bg-card p-6">
        {!creating && !selected ? (
          <p className="text-sm text-muted-foreground">Select a skill or create a new one.</p>
        ) : (
          <>
            {tokenOnce && (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400">Save this skill token now — it won&apos;t be shown again:</p>
                <code className="mt-1 block break-all rounded bg-background p-2 text-xs">{tokenOnce}</code>
              </div>
            )}
            {!creating && selected && (
              <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
                {(["edit", "test", "code", "versions"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`text-sm font-medium capitalize ${tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">v{selected.version}</span>
                  <button onClick={() => toggleEnabled(selected)} className={ghost}>{selected.enabled ? "Disable" : "Enable"}</button>
                </div>
              </div>
            )}

            {error && <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

            {(creating || tab === "edit") && (
              <SkillForm draft={draft} setDraft={setDraft} creating={creating} onSave={save} />
            )}
            {!creating && tab === "test" && selected && <TestConsole skill={selected} />}
            {!creating && tab === "code" && selected && <CodeGen skill={selected} />}
            {!creating && tab === "versions" && selected && <Versions skill={selected} onRolledBack={load} />}
          </>
        )}
      </section>
    </div>
  );
}

function SkillForm({ draft, setDraft, creating, onSave }: {
  draft: ReturnType<typeof blankDraft>;
  setDraft: (d: ReturnType<typeof blankDraft>) => void;
  creating: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Name (snake_case)</label>
          <input className={field} value={draft.name} disabled={!creating} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="send_slack_message" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Label</label>
          <input className={field} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description (sent to the AI)</label>
        <textarea className={field} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select className={field} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Handler URL (HTTPS)</label>
          <input className={field} value={draft.handlerurl} onChange={(e) => setDraft({ ...draft, handlerurl: e.target.value })} placeholder="https://…" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.async} onChange={(e) => setDraft({ ...draft, async: e.target.checked })} />
        Runs asynchronously (background subagent)
      </label>
      <div>
        <label className="mb-2 block text-sm font-medium">Input schema</label>
        <JSONSchemaEditor value={draft.inputschema} onChange={(s) => setDraft({ ...draft, inputschema: s })} />
      </div>
      <button onClick={onSave} className={primary}>{creating ? "Create skill (disabled)" : "Save changes"}</button>
    </div>
  );
}

function TestConsole({ skill }: { skill: Skill }) {
  const [input, setInput] = useState("{}");
  const [result, setResult] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setErr(null); setBusy(true);
    let parsed: unknown;
    try { parsed = JSON.parse(input); } catch { setErr("Input must be valid JSON."); setBusy(false); return; }
    const res = await fetch(`/api/studio/skills/${skill.id}/test`, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
      body: JSON.stringify({ input: parsed }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(Array.isArray(data.details) ? data.details.join("; ") : data.error ?? "Test failed");
    else setResult(data);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Sends a POST to the handler URL with the <code>X-Skill-Token</code> header.</p>
      <textarea className={`${field} font-mono`} rows={5} value={input} onChange={(e) => setInput(e.target.value)} />
      {err && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
      <button onClick={run} disabled={busy} className={primary}>{busy ? "Sending…" : "Send test request"}</button>
      {result != null && (
        <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

function CodeGen({ skill }: { skill: Skill }) {
  const [lang, setLang] = useState<"typescript" | "python" | "javascript">("typescript");
  const [source, setSource] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);

  async function gen(l: typeof lang) {
    setLang(l);
    const res = await fetch(`/api/studio/skills/${skill.id}/generate-handler`, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
      body: JSON.stringify({ language: l }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setSource(data.source); setChecklist(data.checklist ?? []); }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- one-time generate on mount
  useEffect(() => { void gen("typescript"); }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["typescript", "python", "javascript"] as const).map((l) => (
          <button key={l} onClick={() => gen(l)} className={`${ghost} ${lang === l ? "border-primary" : ""}`}>{l}</button>
        ))}
        <button onClick={() => navigator.clipboard.writeText(source)} className={`${ghost} ml-auto`}>Copy</button>
      </div>
      <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-background p-3 text-xs">{source}</pre>
      {checklist.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          <p className="mb-2 font-semibold">Deploy checklist</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            {checklist.map((c, i) => <li key={i}>{c}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function Versions({ skill, onRolledBack }: { skill: Skill; onRolledBack: () => void }) {
  const [versions, setVersions] = useState<Array<{ id: string; version: string; previousversion: string | null; changedfields: string[] | null; updatedat: string }>>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/studio/skills/${skill.id}/versions`, { credentials: "include" });
    if (res.ok) setVersions((await res.json()).versions);
  }, [skill.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async load: setState runs after await
  useEffect(() => { void load(); }, [load]);

  async function rollback(version: string) {
    await fetch(`/api/studio/skills/${skill.id}/rollback`, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
      body: JSON.stringify({ version }),
    });
    await load();
    onRolledBack();
  }

  return (
    <ul className="space-y-2">
      {versions.map((v) => (
        <li key={v.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <span>
            <span className="font-medium">v{v.version}</span>
            <span className="ml-2 text-xs text-muted-foreground">{(v.changedfields ?? []).join(", ")}</span>
          </span>
          <button onClick={() => rollback(v.version)} className={ghost}>Rollback</button>
        </li>
      ))}
      {versions.length === 0 && <p className="text-sm text-muted-foreground">No version history.</p>}
    </ul>
  );
}
