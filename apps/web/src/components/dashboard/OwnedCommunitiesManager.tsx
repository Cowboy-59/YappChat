"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Hash, Plus, Trash2, X } from "lucide-react";

/**
 * Spec 017 — profile-area management for the communities you OWN: full CRUD on
 * the community (name/description/policy/delete) and on each of its spaces
 * (create/rename/topic/mode/delete). Mutations dispatch `nav:refresh` so the
 * sidebar tree stays in sync.
 */

type Discoverability = "public" | "unlisted";
type JoinPolicy = "open" | "approval" | "invite";

type Community = {
  id: string;
  name: string;
  description: string;
  discoverability: Discoverability;
  joinpolicy: JoinPolicy;
  role: "owner" | "moderator" | "member";
};
type Space = {
  id: string;
  name: string;
  topic: string;
  mode: "chat" | "broadcast";
  joinpolicy: JoinPolicy | null; // null = inherit the community
  adminonly: boolean;
  corponly: boolean;
};

// "Who can enter" — a single selector spanning join policy + the corp-only flag.
type Entry = "inherit" | "approval" | "invite" | "corp";
function spaceEntry(s: { joinpolicy: JoinPolicy | null; corponly: boolean }): Entry {
  if (s.corponly) return "corp";
  if (s.joinpolicy === "approval" || s.joinpolicy === "invite") return s.joinpolicy;
  return "inherit"; // null or "open" → inherit
}
function entryToPatch(entry: Entry): { joinpolicy: JoinPolicy | null; corponly: boolean } {
  if (entry === "corp") return { joinpolicy: null, corponly: true };
  if (entry === "approval" || entry === "invite") return { joinpolicy: entry, corponly: false };
  return { joinpolicy: null, corponly: false };
}

const field = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm";
const btn = "inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50`;
const ghost = `${btn} border border-border hover:bg-muted disabled:opacity-50`;
const danger = `${btn} border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50`;

function refreshNav() {
  window.dispatchEvent(new CustomEvent("nav:refresh"));
}

export function OwnedCommunitiesManager() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/communities", { credentials: "include" });
    if (r.ok) {
      const all = ((await r.json()).communities as Community[]) ?? [];
      setCommunities(all.filter((c) => c.role === "owner"));
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, [load]);

  if (loaded && communities.length === 0) return null; // nothing to manage

  const managing = communities.find((c) => c.id === managingId) ?? null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold">Manage your communities</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {communities.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{c.description || "No description"}</div>
            </div>
            <button onClick={() => setManagingId(c.id)} className={ghost}>
              Manage
            </button>
          </div>
        ))}
      </div>

      {managing && (
        <Modal title={`Manage · ${managing.name}`} onClose={() => setManagingId(null)}>
          <div className="space-y-4">
            <CommunityEditor
              community={managing}
              onSaved={load}
              onDeleted={() => {
                setManagingId(null);
                void load();
              }}
            />
            <SpacesManager communityId={managing.id} />
          </div>
        </Modal>
      )}
    </section>
  );
}

/** Centered modal dialog (backdrop + Escape close), no extra deps. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="truncate text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CommunityEditor({
  community,
  onSaved,
  onDeleted,
}: {
  community: Community;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [discoverability, setDiscoverability] = useState<Discoverability>(community.discoverability);
  const [joinpolicy, setJoinpolicy] = useState<JoinPolicy>(community.joinpolicy);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const dirty =
    name.trim() !== community.name ||
    description !== community.description ||
    discoverability !== community.discoverability ||
    joinpolicy !== community.joinpolicy;

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const r = await fetch(`/api/communities/${community.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim(), description, discoverability, joinpolicy }),
    });
    setBusy(false);
    if (r.ok) {
      refreshNav();
      onSaved();
    }
  }
  async function remove() {
    setBusy(true);
    const r = await fetch(`/api/communities/${community.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false);
    if (r.ok) {
      refreshNav();
      onDeleted();
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Community</p>
      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <textarea
        className={`${field} min-h-[60px] resize-y`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Discoverability
          <select className={field} value={discoverability} onChange={(e) => setDiscoverability(e.target.value as Discoverability)}>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Join policy
          <select className={field} value={joinpolicy} onChange={(e) => setJoinpolicy(e.target.value as JoinPolicy)}>
            <option value="open">Open</option>
            <option value="approval">Approval</option>
            <option value="invite">Invite-only</option>
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={save} disabled={!dirty || busy} className={primary}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {confirming ? (
          <span className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Delete community?</span>
            <button onClick={remove} disabled={busy} className={danger}>
              Yes, delete
            </button>
            <button onClick={() => setConfirming(false)} className={ghost}>
              Cancel
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className={danger} title="Delete this community">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

export function SpacesManager({ communityId }: { communityId: string }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/communities/${communityId}/spaces`, { credentials: "include" });
    if (r.ok) setSpaces(((await r.json()).spaces as Space[]) ?? []);
  }, [communityId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, [load]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spaces</p>
        <button onClick={() => setAdding((v) => !v)} className={ghost}>
          <Plus className="h-3.5 w-3.5" /> Space
        </button>
      </div>
      {adding && (
        <SpaceCreateRow
          communityId={communityId}
          onCreated={() => {
            setAdding(false);
            void load();
            refreshNav();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <div className="space-y-1.5">
        {spaces.map((s) => (
          <SpaceRow key={s.id} communityId={communityId} space={s} onChanged={() => { void load(); refreshNav(); }} />
        ))}
        {spaces.length === 0 && !adding && <p className="text-xs text-muted-foreground">No spaces yet.</p>}
      </div>
    </div>
  );
}

function SpaceRow({
  communityId,
  space,
  onChanged,
}: {
  communityId: string;
  space: Space;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [topic, setTopic] = useState(space.topic);
  const [mode, setMode] = useState(space.mode);
  const [entry, setEntry] = useState<Entry>(spaceEntry(space));
  const [adminonly, setAdminonly] = useState(space.adminonly);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const r = await fetch(`/api/communities/${communityId}/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim(), topic, mode, adminonly, ...entryToPatch(adminonly ? "inherit" : entry) }),
    });
    setBusy(false);
    if (r.ok) {
      setEditing(false);
      onChanged();
    }
  }
  async function remove() {
    setBusy(true);
    const r = await fetch(`/api/communities/${communityId}/spaces/${space.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false);
    if (r.ok) onChanged();
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-2">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Space name" />
        <input className={field} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Mode
            <select className={field} value={mode} onChange={(e) => setMode(e.target.value as Space["mode"])}>
              <option value="chat">Chat</option>
              <option value="broadcast">Broadcast</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Who can enter
            <select className={field} value={adminonly ? "inherit" : entry} disabled={adminonly} onChange={(e) => setEntry(e.target.value as Entry)}>
              <option value="inherit">Inherit community</option>
              <option value="approval">Approval (stricter)</option>
              <option value="invite">Invite-only (stricter)</option>
              <option value="corp">Corp members only</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={adminonly} onChange={(e) => setAdminonly(e.target.checked)} />
          Admin space — owners &amp; moderators only
        </label>
        {/* Use AI in this space — enable/configure on edit (FR-019). */}
        <SpaceAiEditor communityId={communityId} spaceId={space.id} />
        {/* Per-space invite link (FR-020) — admits the clicker directly into this
            space, overriding its entry policy. */}
        <SpaceInviteButton communityId={communityId} spaceId={space.id} />
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={busy} className={primary}>
            {busy ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className={ghost}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete the "${space.name}" space? This removes its messages.`)) void remove();
            }}
            disabled={busy}
            className={`${danger} ml-auto`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
      <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{space.name}</span>
      {space.adminonly ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase text-primary">admin</span>
      ) : space.corponly ? (
        <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] uppercase text-sky-600 dark:text-sky-400">corp</span>
      ) : space.joinpolicy && space.joinpolicy !== "open" ? (
        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase text-amber-600 dark:text-amber-400">
          {space.joinpolicy}
        </span>
      ) : null}
      {space.mode === "broadcast" && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">broadcast</span>
      )}
      {confirming ? (
        <span className="flex items-center gap-1">
          <button onClick={remove} disabled={busy} className={danger}>
            Delete
          </button>
          <button onClick={() => setConfirming(false)} className={ghost}>
            Cancel
          </button>
        </span>
      ) : (
        <>
          <button onClick={() => setEditing(true)} className={ghost}>
            Edit
          </button>
          <button onClick={() => setConfirming(true)} className={danger} title="Delete space">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

/** Spec 017 FR-020 — mint a shareable single-use link that admits the clicker
 *  directly into THIS space (overriding its strict policy). Shows the full
 *  clickable URL (not a bare token) so it can be dropped straight into a chat. */
function SpaceInviteButton({ communityId, spaceId }: { communityId: string; spaceId: string }) {
  const [link, setLink] = useState<{ url: string; expiresat: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function generate() {
    setBusy(true);
    try {
      const r = await fetch(`/api/communities/${communityId}/spaces/${spaceId}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ttlHours: 72 }),
      });
      if (r.ok) {
        const { invite } = await r.json();
        setLink({ url: `${window.location.origin}/communities/join?token=${encodeURIComponent(invite.token)}`, expiresat: invite.expiresat });
        setCopied(false);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1">
      <button type="button" onClick={generate} disabled={busy} className={ghost}>
        {busy ? "…" : "Generate invite link"}
      </button>
      {link && (
        <div className="space-y-1 rounded-lg border border-border p-2">
          <input readOnly className={field} value={link.url} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Single-use · expires {new Date(link.expiresat).toLocaleString()}</span>
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => navigator.clipboard?.writeText(link.url).then(() => setCopied(true)).catch(() => {})}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Enable + configure the per-space support AI on edit (FR-019). Adds sources
 *  (PATCH merges; it never drops existing ones); toggles enable/autoanswer/history. */
function SpaceAiEditor({ communityId, spaceId }: { communityId: string; spaceId: string }) {
  type Src = { id: string; kind: "website" | "document" | "history"; title: string; url: string | null; status: string };
  const [enabled, setEnabled] = useState(false);
  const [autoanswer, setAutoanswer] = useState(true);
  const [includehistory, setIncludehistory] = useState(false);
  const [sources, setSources] = useState<Src[]>([]);
  const [website, setWebsite] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetch(`/api/communities/${communityId}/spaces/${spaceId}/ai`, { credentials: "include" });
      if (r.ok && !cancelled) {
        const s = (await r.json()) as { config: { enabled: boolean; autoanswer: boolean; includehistory?: boolean } | null; sources: Src[] };
        setEnabled(Boolean(s.config?.enabled));
        setAutoanswer(s.config?.autoanswer ?? true);
        setIncludehistory(s.config?.includehistory ?? false);
        setSources(s.sources ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, spaceId]);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const newSources: Array<{ kind: "website" | "document"; url?: string; storagekey?: string; title?: string }> = [];
      if (enabled && website.trim()) newSources.push({ kind: "website", url: website.trim() });
      if (enabled)
        for (const f of files) {
          const fd = new FormData();
          fd.append("file", f);
          const u = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
          if (!u.ok) throw new Error(`Couldn't upload "${f.name}"`);
          const { key } = (await u.json()) as { key: string };
          newSources.push({ kind: "document", storagekey: key, title: f.name });
        }
      const r = await fetch(`/api/communities/${communityId}/spaces/${spaceId}/ai`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled, autoanswer, includehistory, ...(newSources.length ? { sources: newSources } : {}) }),
      });
      if (r.ok) {
        const s = (await r.json()) as { sources: Src[] };
        setSources(s.sources ?? sources);
        setWebsite("");
        setFiles([]);
        setNote("AI settings saved.");
      } else setNote("Could not save AI settings.");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Use AI in this space <span className="text-muted-foreground">support bot</span>
      </label>
      {enabled && (
        <div className="space-y-2">
          {sources.length > 0 && (
            <ul className="space-y-1 text-xs">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="shrink-0">{s.kind === "website" ? "🌐" : s.kind === "document" ? "📄" : "💬"}</span>
                  <span className="min-w-0 flex-1 truncate" title={s.url ?? s.title}>
                    {s.kind === "history" ? "Space history" : s.title || s.url}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{s.status}</span>
                </li>
              ))}
            </ul>
          )}
          <input className={field} type="url" placeholder="Add a docs website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={`${ghost} px-2 text-xs`} onClick={() => fileRef.current?.click()}>
              + Add files
            </button>
            <span className="text-[11px] text-muted-foreground">PDF, DOCX, MD, TXT</span>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.md,.markdown,.txt,.htm,.html"
              className="hidden"
              onChange={(e) => setFiles((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 20))}
            />
          </div>
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs">
                  <span className="truncate">{f.name}</span>
                  <button className="ml-2 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={includehistory} onChange={(e) => setIncludehistory(e.target.checked)} />
            Also answer from this space&apos;s history
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={autoanswer} onChange={(e) => setAutoanswer(e.target.checked)} />
            Auto-answer questions members post
          </label>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className={ghost}>
          {busy ? "Saving…" : "Save AI"}
        </button>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

function SpaceCreateRow({
  communityId,
  onCreated,
  onCancel,
}: {
  communityId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<Space["mode"]>("chat");
  const [entry, setEntry] = useState<Entry>("inherit");
  const [adminonly, setAdminonly] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const { joinpolicy, corponly } = entryToPatch(adminonly ? "inherit" : entry);
    const r = await fetch(`/api/communities/${communityId}/spaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: name.trim(),
        topic,
        mode,
        adminonly,
        corponly,
        ...(joinpolicy ? { joinpolicy } : {}),
      }),
    });
    setBusy(false);
    if (r.ok) onCreated();
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
      <input autoFocus className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="New space name" />
      <input className={field} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Mode
          <select className={field} value={mode} onChange={(e) => setMode(e.target.value as Space["mode"])}>
            <option value="chat">Chat</option>
            <option value="broadcast">Broadcast</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Who can enter
          <select className={field} value={adminonly ? "inherit" : entry} disabled={adminonly} onChange={(e) => setEntry(e.target.value as Entry)}>
            <option value="inherit">Inherit community</option>
            <option value="approval">Approval (stricter)</option>
            <option value="invite">Invite-only (stricter)</option>
            <option value="corp">Corp members only</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={adminonly} onChange={(e) => setAdminonly(e.target.checked)} />
        Admin space — owners &amp; moderators only
      </label>
      <div className="flex items-center gap-2">
        <button onClick={create} disabled={!name.trim() || busy} className={primary}>
          {busy ? "Creating…" : "Create"}
        </button>
        <button onClick={onCancel} className={ghost}>
          Cancel
        </button>
      </div>
    </div>
  );
}
