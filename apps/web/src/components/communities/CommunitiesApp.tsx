"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WSProvider, useWSClient, useWSEvent } from "@/components/ws/WSProvider";
import { SpaceCreateForm, type SpaceCreatePayload } from "@/components/communities/SpaceCreateForm";
import { SpaceAiPanel } from "@/components/communities/SpaceAiPanel";
import { SpacesManager } from "@/components/dashboard/OwnedCommunitiesManager";
import { MessageText } from "@/components/chat/MessageText";
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
  authoravatar?: string | null;
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

/** Just the clock time (e.g. "2:45 PM") for the in-bubble timestamp. */
function clockTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** True when two ISO timestamps fall on the same local calendar day. */
function sameLocalDay(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** "Today" / "Yesterday" / "Mon, Jul 2" for a date separator. */
function dayLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Small circular avatar for a message author (image or initial fallback). */
function MsgAvatar({ url, name }: { url?: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 avatar URL, not a static asset
    return <img src={url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold uppercase text-foreground">
      {name.slice(0, 1)}
    </span>
  );
}

/** A bold date separator line shown between message groups from different days. */
function DateDivider({ iso }: { iso?: string }) {
  return (
    <div className="my-3 flex items-center gap-3 px-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{dayLabel(iso)}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
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
  const [discoverability, setDiscoverability] = useState<Discoverability>("public");
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
        {invite &&
          (() => {
            // FR-020 — hand out the full clickable URL (redeems at /communities/join), not a bare token.
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/communities/join?token=${encodeURIComponent(invite.token)}`;
            return (
              <div className="space-y-1 rounded-lg border border-border p-2">
                <input readOnly className={field} value={url} onFocus={(e) => e.currentTarget.select()} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Single-use · expires {new Date(invite.expiresat).toLocaleString()}</span>
                  <button
                    className="font-semibold text-primary hover:underline"
                    onClick={() => navigator.clipboard?.writeText(url).catch(() => {})}
                  >
                    Copy
                  </button>
                </div>
              </div>
            );
          })()}
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

/** Public community discovery: live search + join/request per policy + create. */
function DiscoverPanel({ onJoined, onCreate }: { onJoined: () => void; onCreate: () => void }) {
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
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <input
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Search public communities…"
          value={q}
          onChange={(e) => onChange(e.target.value)}
        />
        <button onClick={onCreate} className={`${primary} shrink-0 whitespace-nowrap`} title="Create your own community">
          + Add your own
        </button>
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

function Inner({ currentUserId, autoTranslate }: { currentUserId: string; autoTranslate: boolean }) {
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const convRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the message list is scrolled to (near) the bottom. Drives
  // bottom-anchored auto-scroll: only follow new messages when already at the
  // bottom, so scrolling up to read history isn't interrupted.
  const atBottomRef = useRef(true);
  const onListScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  // Ctrl + mouse-wheel zoom level for the message area only (0.6–2.0).
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    convRef.current = space?.conversationid ?? null;
  }, [space]);

  // Restore the saved zoom level once on mount (shared with the chats view).
  useEffect(() => {
    try {
      const saved = parseFloat(localStorage.getItem("chatZoom") ?? "");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore from localStorage
      if (saved >= 0.6 && saved <= 2) setZoom(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // Ctrl + mouse-wheel zooms ONLY the message area, not the whole page. React's
  // onWheel is passive, so attach a native non-passive listener to preventDefault
  // the browser page zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => {
        const next = Math.min(2, Math.max(0.6, Math.round((z + (e.deltaY < 0 ? 0.1 : -0.1)) * 10) / 10));
        try {
          localStorage.setItem("chatZoom", String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [space]);

  // Bottom-anchored auto-scroll: follow new messages only when the viewer is
  // already at the bottom (otherwise leave them where they scrolled).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Opening a space always jumps to the bottom (newest), regardless of prior scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
  }, [space?.id]);

  // Auto-grow the composer textarea to fit its content (word-wraps, caps at
  // ~6 lines then scrolls). Runs on every content change — typing, emoji
  // insert, and the reset-to-empty after send.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input, space]);

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
  const pDiscover = params.get("discover");

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

  // The Communities "＋" opens Discover (browse everything, with a create button).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror URL intent into local UI state
    if (pDiscover) { setManaging(false); setDiscovering(true); }
  }, [pDiscover]);

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
    atBottomRef.current = true; // sending my own message always jumps to newest
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar — the sidebar accordion owns the community/space tree. */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
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

      <section
        className="flex min-h-0 flex-1 flex-col rounded-xl border border-border"
        style={{ backgroundColor: "color-mix(in srgb, hsl(var(--card)), #fff 14%)" }}
      >
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
              onCreate={() => {
                setDiscovering(false);
                setCreating(true);
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
              ref={scrollRef}
              onScroll={onListScroll}
              className={`relative min-h-0 flex-1 overflow-y-auto p-4 ${dragOver ? "ring-2 ring-inset ring-primary" : ""}`}
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
              <div className="space-y-3" style={{ zoom }}>
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const divider = !sameLocalDay(prev?.createdat, m.createdat) ? <DateDivider iso={m.createdat} /> : null;
                const mine = m.authorid === currentUserId;
                const isBot = m.authorid === AI_ASSISTANT_AUTHOR_ID;
                const label = isBot ? "🖖 SPOCK AI" : (m.authorname ?? `${m.authorid.slice(0, 8)}…`);
                return (
                  <Fragment key={m.id}>
                    {divider}
                    <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                      {!mine && <MsgAvatar url={isBot ? null : m.authoravatar} name={label} />}
                      <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                        {!mine &&
                          (isBot ? (
                            <span className="mb-0.5 px-1 text-xs font-semibold text-muted-foreground">{label}</span>
                          ) : (
                            <button
                              type="button"
                              title="Ask to connect"
                              onClick={() => askToConnect(m.authorid, m.authorname ?? "this person")}
                              className="mb-0.5 px-1 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                            >
                              {label}
                            </button>
                          ))}
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
                            className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-green-200 text-slate-950 dark:bg-green-800 dark:text-green-50" : isBot ? "bg-muted text-foreground" : "bg-[color-mix(in_srgb,var(--color-cyan-500),#fff_20%)] text-slate-950"}`}
                          >
                            <MessageText
                              messageId={m.id}
                              content={m.content}
                              translate={autoTranslate && !mine}
                              render={linkify}
                            />
                            <span className="mt-0.5 block text-right text-[10px] opacity-60">{clockTime(m.createdat)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
              </div>
            </div>
            <div className="relative shrink-0 border-t border-border p-3">
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
              <div className="flex items-end gap-2">
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
                <textarea
                  ref={inputRef}
                  rows={1}
                  className="max-h-40 flex-1 resize-none overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed"
                  placeholder={uploading ? "Uploading…" : `Message #${space.name}… (Enter to send, Ctrl+Enter for a new line)`}
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
                    // Enter sends; Ctrl+Enter / Shift+Enter insert a newline.
                    if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                      e.preventDefault();
                      void send();
                    } else if (e.key === "Escape") {
                      setShowEmoji(false);
                    }
                  }}
                />
                <button onClick={send} className={`${primary} self-end`} disabled={uploading}>
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

export function CommunitiesApp({ currentUserId, autoTranslate }: { currentUserId: string; autoTranslate: boolean }) {
  return (
    <WSProvider>
      <Inner currentUserId={currentUserId} autoTranslate={autoTranslate} />
    </WSProvider>
  );
}
