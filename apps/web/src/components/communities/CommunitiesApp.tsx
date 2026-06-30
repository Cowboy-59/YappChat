"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WSProvider, useWSClient, useWSEvent } from "@/components/ws/WSProvider";
import { SpaceCreateForm, type SpaceCreatePayload } from "@/components/communities/SpaceCreateForm";
import { SpaceAiPanel } from "@/components/communities/SpaceAiPanel";
import { SpacesManager } from "@/components/dashboard/OwnedCommunitiesManager";
import { scopes, type WSEvent } from "@/lib/ws/events";

type Role = "owner" | "moderator" | "member";
type Discoverability = "public" | "unlisted";
type JoinPolicy = "open" | "approval" | "invite";
type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarurl: string | null;
  discoverability: Discoverability;
  joinpolicy: JoinPolicy;
  role: Role;
};
type Space = {
  id: string;
  name: string;
  topic: string;
  mode: "chat" | "broadcast";
  conversationid: string;
};
type Attachment = { url: string; name: string; isImage: boolean };
type Message = {
  id: string;
  authorid: string;
  authorname: string | null;
  content: string | null;
  media: Attachment[]; // presigned attachments (images render inline; others as download chips)
  direction: string;
  createdat: string; // UTC ISO from the engine; rendered in each reader's local time
};

/** Render message text with clickable links (http/https and www.* only — no javascript: etc). */
function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    let url = m[0];
    // Don't swallow trailing sentence punctuation into the link.
    const trail = url.match(/[.,!?;:)\]]+$/)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    const href = url.startsWith("http") ? url : `https://${url}`;
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-80"
      >
        {url}
      </a>,
    );
    if (trail) nodes.push(trail);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Format a UTC ISO timestamp in the reader's local timezone (e.g. "Jun 22, 2:45 PM"). */
function localTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Curated emoji set (no dependency) grouped by category for the composer picker.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: ["😀", "😁", "😂", "🤣", "😊", "😉", "😍", "😘", "😎", "🤔", "😴", "😅", "😇", "🙂", "🙃", "😢", "😭", "😡", "🥳", "🤯", "😳", "🥺", "😬", "🤗"] },
  { label: "Gestures", emojis: ["👍", "👎", "👌", "🙌", "👏", "🙏", "💪", "🤝", "👋", "✌️", "🤞", "👀", "🫡", "🤙"] },
  { label: "Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💯", "✨", "🔥"] },
  { label: "Objects", emojis: ["🎉", "🎊", "✅", "❌", "⚠️", "🚀", "💡", "📌", "📎", "🔔", "⏰", "☕", "🍕", "🎯", "🐛", "👻"] },
];

/** Dependency-free emoji picker; calls onPick with the chosen glyph. */
function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="absolute bottom-12 left-3 z-10 max-h-64 w-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
      {EMOJI_GROUPS.map((g) => (
        <div key={g.label} className="mb-2">
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">{g.label}</div>
          <div className="grid grid-cols-8 gap-0.5">
            {g.emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onPick(e)}
                className="rounded-md p-1 text-lg leading-none hover:bg-muted"
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
type Member = { userid: string; displayname: string; email: string; role: Role; joinedat: string | null };
type JoinRequest = { id: string; userid: string; message: string | null; createdat: string };

// moderator+ gates space creation, invites, member removal, and approvals
// (mirror of the CAPABILITIES map in lib/communities/policy.ts).
const canModerate = (role: Role) => role === "owner" || role === "moderator";

const DISCOVER_HELP: Record<Discoverability, string> = {
  public: "Listed in community discovery",
  unlisted: "Hidden — join only via link or invite",
};
const JOIN_HELP: Record<JoinPolicy, string> = {
  open: "Anyone can join instantly",
  approval: "People request to join; a moderator approves",
  invite: "Invite-only — join requires an invite",
};

const btn = "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;
const field = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm";

// FR-019 — must match AI_ASSISTANT_AUTHOR_ID in lib/communities/spaceai.ts (kept
// local so this client component doesn't import server-only code).
const AI_ASSISTANT_AUTHOR_ID = "yappchat-ai-assistant";

const roleBadge: Record<Role, string> = {
  owner: "bg-primary/15 text-primary",
  moderator: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  member: "bg-muted text-muted-foreground",
};

/** New-community form: name + entry policy (discoverability + join policy). */
function CreateCommunityForm({
  onCreate,
  onCancel,
}: {
  onCreate: (v: { name: string; discoverability: Discoverability; joinpolicy: JoinPolicy }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [discoverability, setDiscoverability] = useState<Discoverability>("unlisted");
  const [joinpolicy, setJoinpolicy] = useState<JoinPolicy>("approval");
  return (
    <div className="mb-3 space-y-2 rounded-lg border border-border bg-muted/40 p-2">
      <input
        autoFocus
        className={field}
        placeholder="Community name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onCreate({ name: name.trim(), discoverability, joinpolicy });
          else if (e.key === "Escape") onCancel();
        }}
      />
      <label className="block text-xs font-semibold text-muted-foreground">
        Visibility
        <select className={`${field} mt-1`} value={discoverability} onChange={(e) => setDiscoverability(e.target.value as Discoverability)}>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
        <span className="mt-0.5 block font-normal">{DISCOVER_HELP[discoverability]}</span>
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        Entry (who can join)
        <select className={`${field} mt-1`} value={joinpolicy} onChange={(e) => setJoinpolicy(e.target.value as JoinPolicy)}>
          <option value="open">Open</option>
          <option value="approval">Approval required</option>
          <option value="invite">Invite-only</option>
        </select>
        <span className="mt-0.5 block font-normal">{JOIN_HELP[joinpolicy]}</span>
      </label>
      <div className="flex gap-1">
        <button
          className={`${primary} flex-1`}
          onClick={() => name.trim() && onCreate({ name: name.trim(), discoverability, joinpolicy })}
        >
          Create
        </button>
        <button className={ghost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Owner/moderator console: entry policy, invites, member directory + removal, join requests. */
function ManagePanel({
  community,
  currentUserId,
  onUpdated,
}: {
  community: Community;
  currentUserId: string;
  onUpdated: (c: Community) => void;
}) {
  const [discoverability, setDiscoverability] = useState<Discoverability>(community.discoverability);
  const [joinpolicy, setJoinpolicy] = useState<JoinPolicy>(community.joinpolicy);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [invite, setInvite] = useState<{ token: string; expiresat: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [mRes, rRes] = await Promise.all([
      fetch(`/api/communities/${community.id}/members`, { credentials: "include" }),
      fetch(`/api/communities/${community.id}/requests`, { credentials: "include" }),
    ]);
    if (mRes.ok) setMembers((await mRes.json()).members);
    if (rRes.ok) setRequests((await rRes.json()).requests);
  }, [community.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void reload();
  }, [reload]);

  const policyDirty = discoverability !== community.discoverability || joinpolicy !== community.joinpolicy;

  async function savePolicy() {
    const r = await fetch(`/api/communities/${community.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ discoverability, joinpolicy }),
    });
    if (r.ok) {
      onUpdated({ ...community, discoverability, joinpolicy });
      setNote("Entry settings saved.");
    } else {
      setNote("Could not save entry settings.");
    }
  }

  async function generateInvite() {
    const r = await fetch(`/api/communities/${community.id}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ttlHours: 72 }),
    });
    if (r.ok) setInvite((await r.json()).invite);
  }

  async function removeMember(uid: string) {
    const r = await fetch(`/api/communities/${community.id}/members/${uid}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) setMembers((p) => p.filter((m) => m.userid !== uid));
    else setNote("Could not remove member (last owner is protected).");
  }

  async function decide(rid: string, decision: "approve" | "deny") {
    const r = await fetch(`/api/communities/${community.id}/requests/${rid}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision }),
    });
    if (r.ok) {
      setRequests((p) => p.filter((x) => x.id !== rid));
      if (decision === "approve") void reload();
    }
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4">
      {note && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{note}</p>}

      {/* Entry policy */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold">Entry settings</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Visibility
            <select className={`${field} mt-1`} value={discoverability} onChange={(e) => setDiscoverability(e.target.value as Discoverability)}>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Who can join
            <select className={`${field} mt-1`} value={joinpolicy} onChange={(e) => setJoinpolicy(e.target.value as JoinPolicy)}>
              <option value="open">Open</option>
              <option value="approval">Approval required</option>
              <option value="invite">Invite-only</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{JOIN_HELP[joinpolicy]} · {DISCOVER_HELP[discoverability]}</p>
        <button className={primary} disabled={!policyDirty} onClick={savePolicy} style={policyDirty ? undefined : { opacity: 0.5 }}>
          Save entry settings
        </button>
      </section>

      {/* Invites */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold">Invite</h3>
        <button className={ghost} onClick={generateInvite}>
          Generate invite link
        </button>
        {invite && (
          <div className="space-y-1 rounded-lg border border-border p-2">
            <input readOnly className={field} value={invite.token} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Single-use · expires {new Date(invite.expiresat).toLocaleString()}</span>
              <button
                className="font-semibold text-primary hover:underline"
                onClick={() => navigator.clipboard?.writeText(invite.token).catch(() => {})}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Spaces — create/edit/remove, set per-space entry policy + admin spaces */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold">Spaces</h3>
        <SpacesManager communityId={community.id} />
      </section>

      {/* Join requests (relevant when approval is required) */}
      {requests.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold">Pending requests ({requests.length})</h3>
          {requests.map((req) => (
            <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span className="min-w-0 truncate text-sm">
                {req.userid.slice(0, 8)}…{req.message ? ` — ${req.message}` : ""}
              </span>
              <span className="flex shrink-0 gap-1">
                <button className={`${primary} px-2`} onClick={() => decide(req.id, "approve")}>
                  Approve
                </button>
                <button className={`${ghost} px-2`} onClick={() => decide(req.id, "deny")}>
                  Deny
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Members */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold">Members ({members.length})</h3>
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.userid} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{m.displayname}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${roleBadge[m.role]}`}>{m.role}</span>
                {m.userid !== currentUserId && (
                  <button className={`${ghost} px-2`} title="Remove member" onClick={() => removeMember(m.userid)}>
                    Remove
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type Discoverable = {
  id: string;
  slug: string;
  name: string;
  description: string;
  joinpolicy: JoinPolicy;
  membercount: number;
  isMember: boolean;
  requested: boolean;
};

/** Public community discovery: live search + join/request per policy. */
function DiscoverPanel({ onJoined }: { onJoined: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Discoverable[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (query: string) => {
    const r = await fetch(`/api/communities/discover?q=${encodeURIComponent(query)}`, { credentials: "include" });
    if (r.ok) setResults((await r.json()).communities);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void run("");
  }, [run]);

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(v), 250);
  }

  async function join(c: Discoverable) {
    setBusy(c.id);
    const r = await fetch(`/api/communities/${c.id}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    setBusy(null);
    if (!r.ok) return;
    const data = await r.json();
    await run(q); // refresh member counts + state
    if (data.status === "member") onJoined();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <input
          autoFocus
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Search public communities…"
          value={q}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {results.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{c.name}</div>
              {c.description && <div className="truncate text-xs text-muted-foreground">{c.description}</div>}
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {c.membercount} member{c.membercount === 1 ? "" : "s"} ·{" "}
                {c.joinpolicy === "open" ? "Open" : c.joinpolicy === "approval" ? "Approval" : "Invite-only"}
              </div>
            </div>
            {c.isMember ? (
              <span className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Joined</span>
            ) : c.requested ? (
              <span className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Requested</span>
            ) : c.joinpolicy === "invite" ? (
              <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground">Invite-only</span>
            ) : (
              <button className={`${primary} shrink-0`} disabled={busy === c.id} onClick={() => join(c)}>
                {c.joinpolicy === "approval" ? "Request" : "Join"}
              </button>
            )}
          </div>
        ))}
        {results.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            {q ? "No public communities match." : "No public communities yet."}
          </p>
        )}
      </div>
    </div>
  );
}

function Inner({ currentUserId }: { currentUserId: string }) {
  const ws = useWSClient();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [space, setSpace] = useState<Space | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [managing, setManaging] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const convRef = useRef<string | null>(null);
  useEffect(() => {
    convRef.current = space?.conversationid ?? null;
  }, [space]);

  const loadCommunities = useCallback(async () => {
    const r = await fetch("/api/communities", { credentials: "include" });
    if (r.ok) setCommunities((await r.json()).communities);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void loadCommunities();
  }, [loadCommunities]);

  const selectCommunity = useCallback(async (c: Community) => {
    setCommunity(c);
    setSpace(null);
    setSpaces([]);
    setMessages([]);
    setManaging(false);
    setDiscovering(false);
    const r = await fetch(`/api/communities/${c.id}/spaces`, { credentials: "include" });
    if (r.ok) setSpaces((await r.json()).spaces);
  }, []);

  const selectSpace = useCallback(
    async (s: Space) => {
      const prev = convRef.current;
      if (prev && prev !== s.conversationid) ws.unsubscribe(scopes.conversation(prev));
      setSpace(s);
      convRef.current = s.conversationid; // switch the live-message filter immediately
      setMessages([]); // clear the previous space's messages so the view switches at once
      setManaging(false);
      setDiscovering(false);
      ws.subscribe(scopes.conversation(s.conversationid));
      const r = await fetch(`/api/engine/conversations/${s.conversationid}/messages`, { credentials: "include" });
      if (r.ok) setMessages((await r.json()).messages);
      // Mark read, then nudge the sidebar so its unread badge clears immediately.
      void fetch(`/api/engine/conversations/${s.conversationid}/read`, { method: "POST", credentials: "include" }).then(
        () => window.dispatchEvent(new CustomEvent("nav:refresh")),
      );
    },
    [ws],
  );

  const onMessage = useCallback((e: WSEvent) => {
    const m = e.payload as Message & { conversationid: string };
    if (m.conversationid !== convRef.current) return;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);
  useWSEvent("message.inbound", onMessage);
  useWSEvent("message.outbound", onMessage);

  // ── URL-driven navigation (the sidebar accordion owns the tree) ──────────────
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pC = params.get("c");
  const pSpace = params.get("space");
  const pNew = params.get("new");

  // Select the community named by ?c once its row is loaded.
  useEffect(() => {
    if (!pC || community?.id === pC) return;
    const c = communities.find((x) => x.id === pC);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async select after await
    if (c) void selectCommunity(c);
  }, [pC, communities, community, selectCommunity]);

  // Select the space named by ?space once its community's spaces are loaded.
  useEffect(() => {
    if (!pSpace || space?.id === pSpace) return;
    const s = spaces.find((x) => x.id === pSpace);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async select after await
    if (s) void selectSpace(s);
  }, [pSpace, spaces, space, selectSpace]);

  // Open the create forms when the sidebar's "＋" deep-links here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror URL intent into local UI state
    if (pNew === "community") setCreating(true);
    else if (pNew === "space") setCreatingSpace(true);
  }, [pNew]);

  /** Drop transient ?new=… params after a create form closes. */
  const clearNew = useCallback(() => {
    if (pNew) router.replace(pC ? `${pathname}?c=${pC}` : pathname);
  }, [pNew, pC, pathname, router]);

  async function createCommunity(v: { name: string; discoverability: Discoverability; joinpolicy: JoinPolicy }) {
    const r = await fetch("/api/communities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(v),
    });
    if (r.ok) {
      setCreating(false);
      await loadCommunities();
      const c = (await r.json()).community as Community;
      // The creator is the owner; the list response carries role, so refetch picks it up.
      void selectCommunity({ ...c, role: "owner" });
      router.replace(`${pathname}?c=${c.id}`);
      window.dispatchEvent(new CustomEvent("nav:refresh"));
    }
  }

  async function createSpace(payload: SpaceCreatePayload) {
    if (!community) return;
    const r = await fetch(`/api/communities/${community.id}/spaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error("Couldn't create the space");
    setCreatingSpace(false);
    const s = (await r.json()).space as Space;
    setSpaces((p) => [...p, s]);
    void selectSpace(s);
    router.replace(`${pathname}?space=${s.id}&c=${community.id}`);
    window.dispatchEvent(new CustomEvent("nav:refresh"));
  }

  function insertEmoji(e: string) {
    const el = inputRef.current;
    if (el && el.selectionStart != null) {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      setInput((v) => v.slice(0, start) + e + v.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + e.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setInput((v) => v + e);
    }
  }

  function addFiles(files: Iterable<File>) {
    const next = [...files].map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (next.length) setPending((p) => [...p, ...next]);
  }
  function removePending(i: number) {
    setPending((p) => {
      const v = p[i];
      if (v) URL.revokeObjectURL(v.url);
      return p.filter((_, idx) => idx !== i);
    });
  }

  // Click a person in a community to ask to connect — delivered as a private
  // message (opens a 1:1 conversation with the connect request).
  async function askToConnect(authorid: string, authorname: string) {
    if (!window.confirm(`Ask ${authorname} to connect and share contact info?`)) return;
    const r = await fetch("/api/contacts/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ addresseeid: authorid }),
    });
    window.alert(r.ok ? `Connect request sent to ${authorname}.` : "Couldn't send the request.");
  }

  async function send() {
    if (!space || (!input.trim() && pending.length === 0) || uploading) return;
    const content = input.trim();

    // Upload any staged images first; collect their S3 keys.
    let mediaurl: string[] = [];
    if (pending.length) {
      setUploading(true);
      try {
        const keys = await Promise.all(
          pending.map(async ({ file }) => {
            const fd = new FormData();
            fd.append("file", file);
            const r = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
            if (!r.ok) throw new Error("upload_failed");
            return (await r.json()).key as string;
          }),
        );
        mediaurl = keys;
      } catch {
        setUploading(false);
        return; // keep the staged images so the user can retry
      }
      setUploading(false);
    }

    setInput("");
    setShowEmoji(false);
    pending.forEach((p) => URL.revokeObjectURL(p.url));
    setPending([]);
    await fetch(`/api/engine/conversations/${space.conversationid}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, mediaurl }),
    });
    return; // message echoes back over WS
  }

  function patchCommunity(updated: Community) {
    setCommunity(updated);
    setCommunities((p) => p.map((c) => (c.id === updated.id ? updated : c)));
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      {/* Toolbar — the sidebar accordion owns the community/space tree. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm">
          <span className="font-semibold text-foreground">{community ? community.name : "Communities"}</span>
          {space && <span className="text-muted-foreground"> · </span>}
          {space && <span className="font-semibold text-foreground"># {space.name}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setDiscovering((v) => !v);
              setManaging(false);
            }}
            className={`${ghost} px-2 ${discovering ? "border-primary bg-muted" : ""}`}
            title="Find communities"
          >
            🔍 Discover
          </button>
          {community && canModerate(community.role) && (
            <button
              onClick={() => {
                setManaging((v) => !v);
                setDiscovering(false);
              }}
              className={`${ghost} px-2 ${managing ? "border-primary bg-muted" : ""}`}
              title="Manage community"
            >
              ⚙ Manage
            </button>
          )}
          {space && community && (
            <SpaceAiPanel key={space.id} communityId={community.id} spaceId={space.id} canModerate={canModerate(community.role)} />
          )}
        </div>
      </div>

      <section className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        {creating ? (
          <div className="p-4">
            <CreateCommunityForm
              onCreate={createCommunity}
              onCancel={() => {
                setCreating(false);
                clearNew();
              }}
            />
          </div>
        ) : creatingSpace && community ? (
          <div className="p-4">
            <SpaceCreateForm
              onCancel={() => {
                setCreatingSpace(false);
                clearNew();
              }}
              onSubmit={createSpace}
            />
          </div>
        ) : discovering ? (
          <>
            <div className="border-b border-border px-4 py-2.5">
              <div className="text-sm font-semibold">Find communities</div>
              <div className="text-xs text-muted-foreground">Public communities you can join</div>
            </div>
            <DiscoverPanel
              onJoined={() => {
                void loadCommunities();
                window.dispatchEvent(new CustomEvent("nav:refresh"));
              }}
            />
          </>
        ) : managing && community ? (
          <>
            <div className="border-b border-border px-4 py-2.5">
              <div className="text-sm font-semibold">Manage · {community.name}</div>
              <div className="text-xs text-muted-foreground">Entry policy, invites, and members</div>
            </div>
            <ManagePanel key={community.id} community={community} currentUserId={currentUserId} onUpdated={patchCommunity} />
          </>
        ) : !space ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <p>Select a space from the sidebar to start chatting.</p>
            <p className="text-xs">
              Use the ＋ next to a community to add a space, or Discover to find communities to join.
            </p>
          </div>
        ) : (
          <>
            {space.topic && (
              <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{space.topic}</div>
            )}
            <div
              className={`relative flex-1 space-y-3 overflow-y-auto p-4 ${dragOver ? "ring-2 ring-inset ring-primary" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              {dragOver && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  Drop files to attach
                </div>
              )}
              {messages.map((m) => {
                const mine = m.authorid === currentUserId;
                const isBot = m.authorid === AI_ASSISTANT_AUTHOR_ID;
                return (
                  <div key={m.id} className={mine ? "text-right" : "text-left"}>
                    <div className={`mb-0.5 flex items-baseline gap-2 px-1 ${mine ? "justify-end" : "justify-start"}`}>
                      {mine || isBot ? (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {isBot ? "🤖 Assistant" : (m.authorname ?? `${m.authorid.slice(0, 8)}…`)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          title="Ask to connect"
                          onClick={() => askToConnect(m.authorid, m.authorname ?? "this person")}
                          className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          {m.authorname ?? `${m.authorid.slice(0, 8)}…`}
                        </button>
                      )}
                      <span className="text-[11px] text-muted-foreground/70" title={new Date(m.createdat).toLocaleString()}>
                        {localTime(m.createdat)}
                      </span>
                    </div>
                    {m.media.length > 0 && (
                      <div className={`mb-1 flex flex-wrap gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                        {m.media.map((att) =>
                          att.isImage ? (
                            <a key={att.url} href={att.url} target="_blank" rel="noopener noreferrer" title={att.name}>
                              {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset */}
                              <img src={att.url} alt={att.name} className="max-h-60 max-w-[16rem] rounded-xl border border-border object-cover" />
                            </a>
                          ) : (
                            <a
                              key={att.url}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.name}
                              className="flex max-w-[16rem] items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left hover:bg-muted"
                              title={`Download ${att.name}`}
                            >
                              <span className="text-lg">📄</span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">{att.name}</span>
                                <span className="block text-[11px] text-muted-foreground">Download</span>
                              </span>
                            </a>
                          ),
                        )}
                      </div>
                    )}
                    {m.content && (
                      <span
                        className={`inline-block max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                      >
                        {linkify(m.content)}
                      </span>
                    )}
                  </div>
                );
              })}
              {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            </div>
            <div className="relative border-t border-border p-3">
              {showEmoji && <EmojiPicker onPick={insertEmoji} />}
              {pending.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pending.map((p, i) => (
                    <div key={p.url} className="relative">
                      {p.file.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                        <img src={p.url} alt={p.file.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
                      ) : (
                        <div
                          className="flex h-16 w-32 flex-col justify-center rounded-lg border border-border bg-background px-2"
                          title={p.file.name}
                        >
                          <span className="text-lg leading-none">📄</span>
                          <span className="mt-1 truncate text-[11px] font-medium">{p.file.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePending(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  className={`${ghost} px-2 text-lg ${showEmoji ? "border-primary bg-muted" : ""}`}
                  title="Emoji"
                >
                  😊
                </button>
                <label className={`${ghost} cursor-pointer px-2 text-lg`} title="Attach files">
                  📎
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <input
                  ref={inputRef}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder={uploading ? "Uploading…" : `Message #${space.name}…`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={(e) => {
                    const files = [...e.clipboardData.files];
                    if (files.length) {
                      e.preventDefault();
                      addFiles(files);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void send();
                    } else if (e.key === "Escape") {
                      setShowEmoji(false);
                    }
                  }}
                />
                <button onClick={send} className={primary} disabled={uploading}>
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function CommunitiesApp({ currentUserId }: { currentUserId: string }) {
  return (
    <WSProvider>
      <Inner currentUserId={currentUserId} />
    </WSProvider>
  );
}
