"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Users, ChevronRight, Plus, Hash, Check, X } from "lucide-react";

type UserLite = { id: string; displayname: string; email: string };
type Contact = UserLite & { conversationid: string | null; avatarurl?: string | null };
type Request = { contactid: string; conversationid: string | null; from: UserLite };
type Outgoing =
  | { kind: "request"; contactid: string; conversationid: string | null; to: UserLite }
  | { kind: "invite"; inviteid: string; email: string };
type Chat = { conversationid: string; kind: string; name: string };

const POLL_MS = 20_000;
function label(u: UserLite): string {
  return u.displayname?.trim() || u.email.split("@")[0];
}

/**
 * The DM hub for the app sidebar: a **Chats** section (conversations with unread
 * badges, plus a nested **Pending** list of requests/invites) and a top-level
 * **Contacts** section with a `+` to add/invite someone. Everything links to
 * `/chats?conv=<id>` (or `/chats?new=1`); the page renders just the conversation.
 */
export function ChatsNav() {
  const activeConv = useSearchParams().get("conv");
  const [chats, setChats] = useState<Chat[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [openChats, setOpenChats] = useState(true);
  const [openContacts, setOpenContacts] = useState(true);
  const [openPending, setOpenPending] = useState(true);

  const load = useCallback(async () => {
    const [chr, cr] = await Promise.all([
      fetch("/api/chats", { credentials: "include" }),
      fetch("/api/contacts", { credentials: "include" }),
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

  // Chats list = conversations that aren't pending (pending shows in its own group).
  const pendingConvIds = new Set(
    [...requests.map((r) => r.conversationid), ...outgoing.map((o) => (o.kind === "request" ? o.conversationid : null))].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const chatList = chats.filter((c) => !pendingConvIds.has(c.conversationid));
  const pendingCount = requests.length + outgoing.length;

  return (
    <>
      {/* ── Chats ────────────────────────────────────────────────────────── */}
      <Header label="Chats" icon={MessageSquare} open={openChats} onToggle={() => setOpenChats((v) => !v)} />
      {openChats && (
        <div className="mb-1 space-y-0.5">
          {chatList.length === 0 && <Empty>No chats yet.</Empty>}
          {chatList.map((c) => (
            <Leaf
              key={c.conversationid}
              href={`/chats?conv=${c.conversationid}`}
              name={c.name}
              unread={unread[c.conversationid] ?? 0}
              active={activeConv === c.conversationid}
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
  addTitle,
}: {
  label: string;
  icon: typeof MessageSquare;
  open: boolean;
  onToggle: () => void;
  addHref?: string;
  addTitle?: string;
}) {
  return (
    <div className="group flex items-center rounded-lg text-muted-foreground">
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-lg font-bold hover:bg-muted hover:text-foreground">
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {addHref && (
        <Link
          href={addHref}
          title={addTitle}
          className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function Leaf({ href, name, unread, active, person, avatarUrl }: { href: string; name: string; unread: number; active: boolean; person?: boolean; avatarUrl?: string | null }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-lg py-1.5 pl-9 pr-2 text-sm ${
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1.5 pl-9 pr-2 text-xs text-muted-foreground">{children}</p>;
}
