"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WSProvider, useWSClient, useWSEvent } from "@/components/ws/WSProvider";
import { scopes, type WSEvent } from "@/lib/ws/events";

type Message = { id: string; authorid: string; authorname?: string | null; content: string | null; direction: string; conversationid?: string; createdat?: string };
type UserLite = { id: string; displayname: string; email: string };
type Contact = UserLite & { conversationid: string | null };
type Request = { contactid: string; conversationid: string | null; from: UserLite };
type Outgoing =
  | { kind: "request"; contactid: string; conversationid: string | null; to: UserLite }
  | { kind: "invite"; inviteid: string; email: string };

const SYSTEM_AUTHOR = "yappchat-contact";

const btn = "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;

function label(u: UserLite): string {
  return u.displayname?.trim() || u.email.split("@")[0];
}

/** Format a UTC ISO timestamp in the reader's local timezone (e.g. "Jun 22, 2:45 PM"). */
function localTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Inner() {
  const ws = useWSClient();
  const [me, setMe] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [groups, setGroups] = useState<Array<{ conversationid: string; title: string }>>([]);

  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const convRef = useRef<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [inviteNotice, setInviteNotice] = useState("");

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("invite");
    if (!reason) return;
    const messages: Record<string, string> = {
      email_mismatch: "That invite was sent to a different email address. Sign in with the invited address to accept it.",
      email_unverified: "Verify your email address before accepting a contact invite.",
      already_used: "That invite has already been used.",
      expired: "That invite link has expired — ask them to send a new one.",
      self_invite: "That invite is for someone else — you're signed in as the account that sent it. Open the link in a signed-out (incognito) window and sign in as the invited address to accept.",
      not_found: "That invite link is invalid.",
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot banner from the accept redirect
    setInviteNotice(messages[reason] ?? "That invite couldn't be accepted.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const loadContacts = useCallback(async () => {
    const [cr, chr] = await Promise.all([
      fetch("/api/contacts", { credentials: "include" }),
      fetch("/api/chats", { credentials: "include" }),
    ]);
    if (cr.ok) {
      const d = (await cr.json()) as { me: string; contacts: Contact[]; requests: Request[]; outgoing?: Outgoing[] };
      setMe(d.me);
      setContacts(d.contacts);
      setRequests(d.requests);
      setOutgoing(d.outgoing ?? []);
    }
    if (chr.ok) {
      const d = (await chr.json()) as { chats: Array<{ conversationid: string; kind: string; title: string }> };
      setGroups(d.chats.filter((c) => c.kind === "group").map((c) => ({ conversationid: c.conversationid, title: c.title || "Group chat" })));
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void loadContacts();
  }, [loadContacts]);

  const openConversation = useCallback(
    async (conversationid: string | null, name: string) => {
      if (!conversationid) return;
      const prev = convRef.current;
      if (prev && prev !== conversationid) ws.unsubscribe(scopes.conversation(prev));
      setActiveConv(conversationid);
      setActiveName(name);
      convRef.current = conversationid;
      setMessages([]);
      ws.subscribe(scopes.conversation(conversationid));
      const r = await fetch(`/api/engine/conversations/${conversationid}/messages`, { credentials: "include" });
      if (r.ok) setMessages(((await r.json()) as { messages: Message[] }).messages);
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

  // Is the active conversation an incoming pending request (→ show Accept/Decline)?
  const pendingIncoming = requests.find((q) => q.conversationid && q.conversationid === activeConv);
  // Can chat freely in: an accepted 1:1 contact, or a group chat I'm in.
  const acceptedContact = contacts.find((c) => c.conversationid === activeConv);
  const isGroup = groups.some((g) => g.conversationid === activeConv);
  const canSend = Boolean(acceptedContact) || isGroup;

  async function send() {
    if (!activeConv || !input.trim()) return;
    const content = input.trim();
    setInput("");
    await fetch(`/api/engine/conversations/${activeConv}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
  }

  async function respond(contactid: string, accept: boolean) {
    await fetch(`/api/contacts/${contactid}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accept }),
    });
    await loadContacts();
  }

  // Withdraw a sent request / cancel an email invite (FR-008); retracts it from the recipient too.
  async function withdraw(o: Outgoing) {
    const url = o.kind === "request" ? `/api/contacts/${o.contactid}` : `/api/contacts/invite/${o.inviteid}`;
    await fetch(url, { method: "DELETE", credentials: "include" });
    if (o.kind === "request" && o.conversationid && o.conversationid === convRef.current) {
      ws.unsubscribe(scopes.conversation(o.conversationid));
      convRef.current = null;
      setActiveConv(null);
    }
    await loadContacts();
  }

  return (
    <div className="flex min-h-[72vh] flex-col gap-3">
      {inviteNotice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground">
          <span>{inviteNotice}</span>
          <button onClick={() => setInviteNotice("")} className={`${ghost} h-7 px-2 text-xs`} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-1 gap-4">
      {/* Left: contacts + requests */}
      <aside className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="text-sm font-semibold text-foreground">Chats</span>
          <button onClick={() => setModalOpen(true)} className={primary} title="New chat / add contact">
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {requests.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requests</p>
              {requests.map((q) => (
                <div key={q.contactid} className="rounded-lg p-2 hover:bg-muted">
                  <p className="truncate text-sm font-medium text-foreground">{label(q.from)}</p>
                  <p className="truncate text-xs text-muted-foreground">wants to connect</p>
                  <div className="mt-1 flex gap-1">
                    <button onClick={() => respond(q.contactid, true)} className={`${primary} h-7 px-2 text-xs`}>
                      Accept
                    </button>
                    <button onClick={() => respond(q.contactid, false)} className={`${ghost} h-7 px-2 text-xs`}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {outgoing.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
              {outgoing.map((o) => {
                const name = o.kind === "request" ? label(o.to) : o.email;
                const key = o.kind === "request" ? o.contactid : o.inviteid;
                const conv = o.kind === "request" ? o.conversationid : null;
                return (
                  <div key={key} className="flex items-center gap-1 rounded-lg p-2 hover:bg-muted">
                    <button
                      onClick={() => conv && openConversation(conv, name)}
                      disabled={!conv}
                      className={`min-w-0 flex-1 text-left ${activeConv && activeConv === conv ? "font-semibold" : ""}`}
                    >
                      <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">{o.kind === "invite" ? "invited — pending" : "pending"}</p>
                    </button>
                    <button
                      onClick={() => withdraw(o)}
                      className={`${ghost} h-7 px-2 text-xs`}
                      title={o.kind === "invite" ? "Cancel invite" : "Withdraw request"}
                      aria-label={o.kind === "invite" ? "Cancel invite" : "Withdraw request"}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacts</p>
          {contacts.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No contacts yet. Tap + to find people.</p>}
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.conversationid, label(c))}
              className={`block w-full truncate rounded-lg p-2 text-left text-sm hover:bg-muted ${activeConv === c.conversationid ? "bg-muted font-semibold" : ""}`}
            >
              {label(c)}
            </button>
          ))}
          {groups.length > 0 && (
            <>
              <p className="mt-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Group chats</p>
              {groups.map((g) => (
                <button
                  key={g.conversationid}
                  onClick={() => openConversation(g.conversationid, g.title)}
                  className={`block w-full truncate rounded-lg p-2 text-left text-sm hover:bg-muted ${activeConv === g.conversationid ? "bg-muted font-semibold" : ""}`}
                >
                  {g.title}
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Right: active conversation */}
      <section className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        {!activeConv ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Select a contact, or tap + to start a chat.
          </div>
        ) : (
          <>
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{activeName || "Chat"}</div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => {
                if (m.authorid === SYSTEM_AUTHOR) {
                  return (
                    <p key={m.id} className="text-center text-xs italic text-muted-foreground">
                      {m.content}
                    </p>
                  );
                }
                const mine = m.authorid === me;
                return (
                  <div key={m.id} className={mine ? "text-right" : "text-left"}>
                    <div className={`mb-0.5 flex items-baseline gap-2 px-1 ${mine ? "justify-end" : "justify-start"}`}>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {m.authorname ?? `${m.authorid.slice(0, 8)}…`}
                      </span>
                      <span className="text-[11px] text-muted-foreground/70" title={m.createdat ? new Date(m.createdat).toLocaleString() : ""}>
                        {m.createdat ? localTime(m.createdat) : ""}
                      </span>
                    </div>
                    {m.content && (
                      <span
                        className={`inline-block max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                      >
                        {m.content}
                      </span>
                    )}
                  </div>
                );
              })}
              {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            </div>

            {pendingIncoming ? (
              <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 p-3">
                <span className="text-sm text-foreground">{label(pendingIncoming.from)} wants to connect.</span>
                <div className="flex gap-1">
                  <button onClick={() => respond(pendingIncoming.contactid, true)} className={primary}>
                    Accept
                  </button>
                  <button onClick={() => respond(pendingIncoming.contactid, false)} className={ghost}>
                    Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-t border-border p-3">
                <input
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                  placeholder={canSend ? "Message…" : "Waiting for them to accept your request…"}
                  value={input}
                  disabled={!canSend}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button onClick={send} className={primary} disabled={!canSend}>
                  Send
                </button>
              </div>
            )}
          </>
        )}
      </section>
      </div>

      {modalOpen && (
        <NewChatModal
          me={me}
          contacts={contacts}
          onClose={() => setModalOpen(false)}
          onChanged={loadContacts}
          onOpenChat={(conversationid, name) => {
            setModalOpen(false);
            void loadContacts();
            void openConversation(conversationid, name);
          }}
        />
      )}
    </div>
  );
}

function NewChatModal({
  me,
  contacts,
  onClose,
  onChanged,
  onOpenChat,
}: {
  me: string;
  contacts: Contact[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onOpenChat: (conversationid: string, name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [selected, setSelected] = useState<UserLite[]>([]);
  const [notice, setNotice] = useState<string>("");
  const contactIds = new Set(contacts.map((c) => c.id));

  useEffect(() => {
    if (q.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results when query is too short
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (r.ok) {
        setResults(((await r.json()) as { results: UserLite[] }).results.filter((u) => u.id !== me));
      } else if (r.status === 429) {
        setResults([]);
        setNotice("You're searching too fast — please slow down for a moment.");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, me]);

  async function requestError(r: Response): Promise<string> {
    const d = (await r.json().catch(() => ({}))) as { error?: string; detail?: string };
    if (r.status === 429) return d.detail || "You're doing that too fast — please slow down.";
    return d.detail || "Couldn't send the request. Please try again.";
  }

  async function connect(u: UserLite) {
    const r = await fetch("/api/contacts/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ addresseeid: u.id }),
    });
    if (r.ok) {
      setNotice(`Connect request sent to ${label(u)}.`);
      await onChanged();
    } else {
      setNotice(await requestError(r));
    }
  }

  async function inviteByEmail() {
    const email = q.trim();
    const r = await fetch("/api/contacts/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    if (r.ok) {
      const d = (await r.json()) as { mode?: string };
      setNotice(d.mode === "requested" ? `Connect request sent to ${email}.` : `Invite emailed to ${email}.`);
      await onChanged();
    } else {
      setNotice(await requestError(r));
    }
  }

  async function startGroup() {
    const r = await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ memberIds: selected.map((u) => u.id) }),
    });
    if (r.ok) {
      const d = (await r.json()) as { conversationid: string };
      onOpenChat(d.conversationid, selected.map(label).join(", "));
    } else if (r.status === 429) {
      setNotice(await requestError(r));
    } else {
      setNotice("Group members must be accepted contacts.");
    }
  }

  function toggle(u: UserLite) {
    setSelected((prev) => (prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]));
  }

  const looksLikeEmail = /\S+@\S+\.\S+/.test(q.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">New chat</h2>
          <button onClick={onClose} className={`${ghost} h-7 px-2`}>
            Close
          </button>
        </div>
        <input
          autoFocus
          className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Search people by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {notice && <p className="mb-2 rounded-lg bg-muted px-3 py-2 text-xs text-foreground">{notice}</p>}

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {results.map((u) => {
            const isContact = contactIds.has(u.id);
            const contactConv = contacts.find((c) => c.id === u.id)?.conversationid ?? null;
            const picked = selected.some((x) => x.id === u.id);
            return (
              <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                <button onClick={() => isContact && toggle(u)} className="min-w-0 flex-1 text-left" disabled={!isContact} title={isContact ? "Select for a group" : ""}>
                  <p className="truncate text-sm font-medium text-foreground">
                    {isContact && <span className={`mr-1 ${picked ? "text-primary" : "text-muted-foreground"}`}>{picked ? "☑" : "☐"}</span>}
                    {label(u)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </button>
                {isContact ? (
                  <button onClick={() => contactConv && onOpenChat(contactConv, label(u))} className={`${primary} h-7 px-2 text-xs`}>
                    Chat
                  </button>
                ) : (
                  <button onClick={() => connect(u)} className={`${ghost} h-7 px-2 text-xs`}>
                    Connect
                  </button>
                )}
              </div>
            );
          })}
          {q.trim().length >= 2 && results.length === 0 && looksLikeEmail && (
            <button onClick={inviteByEmail} className={`${ghost} w-full justify-start`}>
              ✉ Invite {q.trim()} to connect
            </button>
          )}
          {q.trim().length >= 2 && results.length === 0 && !looksLikeEmail && (
            <p className="px-2 py-2 text-sm text-muted-foreground">No users found. Enter an email to invite someone new.</p>
          )}
        </div>

        {selected.length >= 2 && (
          <button onClick={startGroup} className={`${primary} mt-3 w-full`}>
            Start group chat with {selected.length} contacts
          </button>
        )}
      </div>
    </div>
  );
}

export function ChatsApp() {
  return (
    <WSProvider>
      <Inner />
    </WSProvider>
  );
}
