"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Users, ChevronRight, Plus, Hash, Check, X, Folder, FolderPlus, MoreVertical, Trash2 } from "lucide-react";

type UserLite = { id: string; displayname: string; email: string };
type Contact = UserLite & { conversationid: string | null; avatarurl?: string | null };
type Request = { contactid: string; conversationid: string | null; from: UserLite };
type Outgoing =
  | { kind: "request"; contactid: string; conversationid: string | null; to: UserLite }
  | { kind: "invite"; inviteid: string; email: string };
type Chat = { conversationid: string; kind: string; name: string; groupingid: string | null };
type Grouping = { id: string; name: string; type: "general" | "projects"; position: number };

const POLL_MS = 20_000;
const OPEN_KEY = "yc.chatGroupings.open";

function label(u: UserLite): string {
  return u.displayname?.trim() || u.email.split("@")[0];
}

/**
 * The DM hub for the app sidebar: a **Chats** section (spec 090 grouping folders
 * above the ungrouped conversations, each with unread badges, plus a nested
 * **Pending** list) and a top-level **Contacts** section with a `+` to add/invite
 * someone. Everything links to `/chats?conv=<id>` (or `/chats?new=1`).
 *
 * Groupings (spec 090) are personal, view-only folders: creating one and filing a
 * room into it changes only this user's sidebar — never room membership or access.
 */
export function ChatsNav() {
  const router = useRouter();
  const activeConv = useSearchParams().get("conv");
  const [chats, setChats] = useState<Chat[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [groupings, setGroupings] = useState<Grouping[]>([]);
  const [openChats, setOpenChats] = useState(true);
  const [openContacts, setOpenContacts] = useState(true);
  const [openPending, setOpenPending] = useState(true);
  // Per-browser folder expand/collapse (default open); mirrors AppSidebar's localStorage accordion.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showNew, setShowNew] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // Grouping id whose "create room" form is open (null = none).
  const [createFor, setCreateFor] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OPEN_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage
      if (raw) setOpenGroups(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore malformed cache */
    }
  }, []);
  const setGroupOpen = useCallback((id: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: open };
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / disabled storage */
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const [chr, cr, gr] = await Promise.all([
      fetch("/api/chats", { credentials: "include" }),
      fetch("/api/contacts", { credentials: "include" }),
      fetch("/api/chat-groupings", { credentials: "include" }),
    ]);
    if (chr.ok) {
      const d = (await chr.json()) as { chats: Chat[]; unread?: Record<string, number> };
      setChats(d.chats ?? []);
      setUnread(d.unread ?? {});
    }
    if (cr.ok) {
      const d = (await cr.json()) as { contacts: Contact[]; requests: Request[]; outgoing?: Outgoing[] };
      setContacts(d.contacts ?? []);
      setRequests(d.requests ?? []);
      setOutgoing(d.outgoing ?? []);
    }
    if (gr.ok) {
      const d = (await gr.json()) as { groupings: Grouping[] };
      setGroupings(d.groupings ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void load();
  }, [load, activeConv]);
  useEffect(() => {
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener("nav:refresh", h);
    return () => window.removeEventListener("nav:refresh", h);
  }, [load]);

  async function respond(contactid: string, accept: boolean) {
    await fetch(`/api/contacts/${contactid}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accept }),
    });
    await load();
    window.dispatchEvent(new CustomEvent("nav:refresh"));
  }
  async function withdraw(o: Outgoing) {
    const url = o.kind === "request" ? `/api/contacts/${o.contactid}` : `/api/contacts/invite/${o.inviteid}`;
    await fetch(url, { method: "DELETE", credentials: "include" });
    await load();
    window.dispatchEvent(new CustomEvent("nav:refresh"));
  }

  async function createGrouping(name: string, type: "general" | "projects") {
    const r = await fetch("/api/chat-groupings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, type }),
    });
    if (r.ok) {
      setShowNew(false);
      await load();
    }
  }
  async function deleteGrouping(id: string) {
    await fetch(`/api/chat-groupings/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }
  async function createRoomInGroup(groupingid: string, title: string, memberIds: string[]) {
    const r = await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ groupingid, title, memberIds }),
    });
    if (r.ok) {
      const d = (await r.json()) as { conversationid?: string };
      setCreateFor(null);
      await load();
      if (d.conversationid) router.push(`/chats?conv=${d.conversationid}`);
    }
  }
  async function moveRoom(conversationid: string, groupingid: string | null) {
    setMenuFor(null);
    await fetch(`/api/chats/${conversationid}/grouping`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ groupingid }),
    });
    await load();
  }

  // Chats list = conversations that aren't pending (pending shows in its own group).
  const chatList = useMemo(() => {
    const pendingConvIds = new Set(
      [...requests.map((r) => r.conversationid), ...outgoing.map((o) => (o.kind === "request" ? o.conversationid : null))].filter(
        (id): id is string => Boolean(id),
      ),
    );
    return chats.filter((c) => !pendingConvIds.has(c.conversationid));
  }, [chats, requests, outgoing]);
  const groupingIds = useMemo(() => new Set(groupings.map((g) => g.id)), [groupings]);
  // A room is "grouped" only if its groupingid still maps to one of the caller's
  // groupings; a stale/foreign id falls back to the ungrouped list (defensive).
  const ungrouped = chatList.filter((c) => !c.groupingid || !groupingIds.has(c.groupingid));
  const pendingCount = requests.length + outgoing.length;

  const roomMenu = (c: Chat) => (
    <RoomMenu
      open={menuFor === c.conversationid}
      onToggle={() => setMenuFor((v) => (v === c.conversationid ? null : c.conversationid))}
      groupings={groupings}
      current={c.groupingid}
      onMove={(gid) => moveRoom(c.conversationid, gid)}
    />
  );

  return (
    <>
      {/* ── Chats ────────────────────────────────────────────────────────── */}
      <Header
        label="Chats"
        icon={MessageSquare}
        open={openChats}
        onToggle={() => setOpenChats((v) => !v)}
        onAdd={() => setShowNew((v) => !v)}
        addTitle="New grouping"
      />
      {openChats && (
        <div className="mb-1 space-y-0.5">
          {showNew && <NewGroupingForm onCreate={createGrouping} onCancel={() => setShowNew(false)} />}

          {/* Grouping folders (spec 090) */}
          {groupings.map((g) => {
            const rooms = chatList.filter((c) => c.groupingid === g.id);
            const open = openGroups[g.id] ?? true;
            return (
              <div key={g.id}>
                <div className="group/f flex items-center rounded-lg">
                  <button
                    onClick={() => setGroupOpen(g.id, !open)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pl-5 pr-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                    <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate font-medium">{g.name}</span>
                    {g.type === "projects" && (
                      <span className="rounded bg-primary/15 px-1 text-[9px] font-semibold uppercase tracking-wide text-foreground/70">
                        proj
                      </span>
                    )}
                    <span className="ml-auto text-[10px] opacity-60">{rooms.length}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCreateFor((v) => (v === g.id ? null : g.id));
                      setGroupOpen(g.id, true);
                    }}
                    title={g.type === "projects" ? "New project room" : "New room"}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover/f:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteGrouping(g.id)}
                    title="Delete grouping (rooms return to the list)"
                    className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover/f:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {open && (
                  <div className="space-y-0.5">
                    {createFor === g.id && (
                      <CreateRoomForm
                        projects={g.type === "projects"}
                        contacts={contacts}
                        onCreate={(title, memberIds) => createRoomInGroup(g.id, title, memberIds)}
                        onCancel={() => setCreateFor(null)}
                      />
                    )}
                    {rooms.length === 0 && createFor !== g.id && <Empty indent>Empty — add or move a chat here.</Empty>}
                    {rooms.map((c) => (
                      <RoomRow
                        key={c.conversationid}
                        href={`/chats?conv=${c.conversationid}`}
                        name={c.name}
                        unread={unread[c.conversationid] ?? 0}
                        active={activeConv === c.conversationid}
                        menu={roomMenu(c)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped chats */}
          {ungrouped.length === 0 && groupings.length === 0 && <Empty>No chats yet.</Empty>}
          {ungrouped.map((c) => (
            <RoomRow
              key={c.conversationid}
              href={`/chats?conv=${c.conversationid}`}
              name={c.name}
              unread={unread[c.conversationid] ?? 0}
              active={activeConv === c.conversationid}
              menu={roomMenu(c)}
            />
          ))}

          {pendingCount > 0 && (
            <>
              <button
                onClick={() => setOpenPending((v) => !v)}
                className="flex w-full min-w-0 items-center gap-1.5 rounded-lg py-1.5 pl-5 pr-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${openPending ? "rotate-90" : ""}`} />
                <span className="truncate font-medium">Pending</span>
                <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-semibold">{pendingCount}</span>
              </button>
              {openPending && (
                <div className="space-y-0.5">
                  {requests.map((q) => (
                    <div key={q.contactid} className="flex items-center gap-1 rounded-lg py-1 pl-9 pr-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={`${label(q.from)} wants to connect`}>
                        {label(q.from)}
                      </span>
                      <button onClick={() => respond(q.contactid, true)} title="Accept" className="inline-flex h-6 w-6 items-center justify-center rounded-md text-primary hover:bg-muted">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => respond(q.contactid, false)} title="Decline" className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {outgoing.map((o) => {
                    const name = o.kind === "request" ? label(o.to) : o.email;
                    const key = o.kind === "request" ? o.contactid : o.inviteid;
                    return (
                      <div key={key} className="flex items-center gap-1 rounded-lg py-1 pl-9 pr-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={`${name} — pending`}>
                          {name} <span className="text-[10px] opacity-70">· pending</span>
                        </span>
                        <button
                          onClick={() => withdraw(o)}
                          title={o.kind === "invite" ? "Cancel invite" : "Withdraw request"}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Contacts (top-level; + adds/invites someone) ─────────────────── */}
      <Header
        label="Contacts"
        icon={Users}
        open={openContacts}
        onToggle={() => setOpenContacts((v) => !v)}
        addHref="/chats?new=1"
        addTitle="Add / invite a person"
      />
      {openContacts && (
        <div className="mb-1 space-y-0.5">
          {contacts.length === 0 && <Empty>No contacts yet.</Empty>}
          {contacts.map((c) => (
            <Leaf
              key={c.id}
              href={c.conversationid ? `/chats?conv=${c.conversationid}` : "/chats?new=1"}
              name={label(c)}
              unread={0}
              active={Boolean(c.conversationid) && activeConv === c.conversationid}
              person
              avatarUrl={c.avatarurl}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── Pieces (mirror the AppSidebar look) ─────────────────────────────────────

function Header({
  label,
  icon: Icon,
  open,
  onToggle,
  addHref,
  onAdd,
  addTitle,
}: {
  label: string;
  icon: typeof MessageSquare;
  open: boolean;
  onToggle: () => void;
  addHref?: string;
  onAdd?: () => void;
  addTitle?: string;
}) {
  return (
    <div className="group flex items-center rounded-lg text-muted-foreground">
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-lg font-bold hover:bg-muted hover:text-foreground">
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {onAdd ? (
        <button
          onClick={onAdd}
          title={addTitle}
          className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      ) : addHref ? (
        <Link
          href={addHref}
          title={addTitle}
          className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/** Inline "New grouping" creator: name + type (General / Projects). */
function NewGroupingForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, type: "general" | "projects") => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"general" | "projects">("general");
  const submit = () => {
    const n = name.trim();
    if (n) onCreate(n, type);
  };
  return (
    <div className="mx-2 mb-1 space-y-1.5 rounded-lg border border-border bg-muted/40 p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Grouping name"
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex items-center gap-1.5">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "general" | "projects")}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
        >
          <option value="general">General</option>
          <option value="projects">Projects</option>
        </select>
        <button onClick={submit} className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90">
          Create
        </button>
        <button onClick={onCancel} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Inline "create a room under this folder" form: a name + optional contact toggles.
 * No members selected = a solo room (a project room bound to remote management in
 * spec 091). A project-folder room opens with its own room id as the first message.
 */
function CreateRoomForm({
  projects,
  contacts,
  onCreate,
  onCancel,
}: {
  projects: boolean;
  contacts: Contact[];
  onCreate: (title: string, memberIds: string[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const submit = () => {
    const n = name.trim();
    // A solo room (no members) needs a name; a multi-member room can go untitled.
    if (selected.size === 0 && !n) return;
    onCreate(n, [...selected]);
  };
  return (
    <div className="mx-2 mb-1 ml-8 space-y-1.5 rounded-lg border border-border bg-muted/40 p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={projects ? "Project room name" : "Room name"}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      {contacts.length > 0 && (
        <div className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border bg-background p-1">
          <p className="px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Members {selected.size === 0 ? "(none = solo)" : `(${selected.size})`}
          </p>
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-sm hover:bg-muted"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  selected.has(c.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {selected.has(c.id) && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{label(c)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button onClick={submit} className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90">
          Create {selected.size === 0 ? "solo room" : "room"}
        </button>
        <button onClick={onCancel} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** A chat row (link) with a hover "move to grouping" menu button on the right. */
function RoomRow({ href, name, unread, active, menu }: { href: string; name: string; unread: number; active: boolean; menu: React.ReactNode }) {
  return (
    <div className="group/r relative flex items-center">
      <Leaf href={href} name={name} unread={unread} active={active} />
      <div className="absolute right-1">{menu}</div>
    </div>
  );
}

/** The per-room dropdown: file into one of the caller's groupings or remove. */
function RoomMenu({
  open,
  onToggle,
  groupings,
  current,
  onMove,
}: {
  open: boolean;
  onToggle: () => void;
  groupings: Grouping[];
  current: string | null;
  onMove: (groupingid: string | null) => void;
}) {
  return (
    <>
      <button
        onClick={onToggle}
        title="Move to grouping"
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${
          open ? "opacity-100" : "opacity-0 group-hover/r:opacity-100"
        }`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-border bg-popover p-1 shadow-md">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Move to</p>
          {groupings.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No groupings yet.</p>}
          {groupings.map((g) => (
            <button
              key={g.id}
              onClick={() => onMove(g.id)}
              disabled={g.id === current}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              {g.id === current && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
          {current && (
            <button
              onClick={() => onMove(null)}
              className="mt-0.5 flex w-full items-center gap-1.5 rounded-md border-t border-border px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              Remove from grouping
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Leaf({ href, name, unread, active, person, avatarUrl }: { href: string; name: string; unread: number; active: boolean; person?: boolean; avatarUrl?: string | null }) {
  return (
    <Link
      href={href}
      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pl-9 pr-2 text-sm ${
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {person ? (
        avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 avatar URL, not a static asset
          <img src={avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold uppercase text-foreground">
            {name.slice(0, 1)}
          </span>
        )
      ) : (
        <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {unread > 0 && !active && (
        <span className="ml-1 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

function Empty({ children, indent }: { children: React.ReactNode; indent?: boolean }) {
  return <p className={`py-1.5 pr-2 text-xs text-muted-foreground ${indent ? "pl-12" : "pl-9"}`}>{children}</p>;
}
