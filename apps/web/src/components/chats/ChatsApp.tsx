"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WSProvider, useWSClient, useWSEvent } from "@/components/ws/WSProvider";
import { RemoteControlPanel } from "@/components/chats/RemoteControlPanel";
import { MessageText } from "@/components/chat/MessageText";
import { scopes, type WSEvent } from "@/lib/ws/events";
import { EmojiPicker } from "./EmojiPicker";
import { GifPicker } from "./GifPicker";

type Attachment = { url: string; name: string; isImage: boolean };
type Message = { id: string; authorid: string; authorname?: string | null; authoravatar?: string | null; isagent?: boolean; content: string | null; direction: string; conversationid?: string; createdat?: string; media?: Attachment[]; deletedat?: string | null };
type UserLite = { id: string; displayname: string; email: string };
type Contact = UserLite & { conversationid: string | null };
type Request = { contactid: string; conversationid: string | null; from: UserLite };
type Chat = { conversationid: string; kind: string; name: string; solo?: boolean };

const SYSTEM_AUTHOR = "yappchat-contact";
/**
 * A message is from Claude/the agent when it carries the robot marker 🤖 AND the
 * word "claude" (e.g. "🤖 Claude on project wxKanban is connected"). In a project
 * room these are posted under the room owner's account but should read as INCOMING —
 * rendered on the left with a "Claude" avatar. The text is kept as-is.
 */
function isClaudeMessage(content: string | null): boolean {
  return !!content && content.includes("🤖") && /claude/i.test(content);
}
// Strip the leading "🤖 Claude" marker for the body — it's shown as the name instead.
const CLAUDE_STRIP = /^\s*🤖\s*claude\b[\s:—-]*/i;

/**
 * Whether text looks like code / command output (so the agent status feed only
 * force-translates PROSE — never git output, diffs, paths, or code blocks).
 */
function looksLikeCode(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.includes("```")) return true; // fenced code block
  if (/(^|\n)\s*[·$>#]\s/.test(t)) return true; // command / output line markers
  if (/[{}[\]<>|]|=>|::|\/\/|\bnpm\b|\bgit\b|\.(ts|tsx|js|jsx|json|md|sql|mjs|cjs)\b|\/api\//.test(t)) return true;
  const symbols = (t.match(/[^\w\s.,!?'"()\-:；，。áéíóúàèìòùäöüñç]/gi) || []).length;
  return symbols / t.length > 0.12; // symbol-dense → treat as code
}

const btn = "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;

function label(u: UserLite): string {
  return u.displayname?.trim() || u.email.split("@")[0];
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

/**
 * Solo-room banner (spec 090): the room's id is the handle you give Claude to
 * connect for remote management — there is no other party and no accept step.
 */
function RoomIdBar({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the id is still selectable in the field */
    }
  };
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 text-xs">
      <span className="shrink-0 font-semibold text-muted-foreground">Room ID</span>
      <code
        onClick={copy}
        title="Click to copy"
        className="min-w-0 flex-1 cursor-pointer truncate rounded bg-background px-2 py-1 font-mono text-foreground"
      >
        {id}
      </code>
      <button
        onClick={copy}
        className="shrink-0 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:bg-muted"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="hidden shrink-0 text-muted-foreground sm:inline">— give this to Claude to connect</span>
    </div>
  );
}

/**
 * Spec 091 — mint a one-time agent token so Claude posts to this room AS ITSELF
 * (author "Claude"), instead of under your account. Paste the token into your
 * machine's Claude agent (Authorization: Bearer <token>). Shown once.
 */
function ClaudeConnectBar({ conversationid }: { conversationid: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/chats/${conversationid}/agent`, { method: "POST", credentials: "include" });
      if (r.ok) setToken(((await r.json()) as { token: string }).token);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the token is still selectable */
    }
  };

  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs">
      <span className="shrink-0 font-semibold text-muted-foreground">Claude token</span>
      {token ? (
        <>
          <code
            onClick={copy}
            title="Click to copy"
            className="min-w-0 flex-1 cursor-pointer truncate rounded bg-background px-2 py-1 font-mono text-foreground"
          >
            {token}
          </code>
          <button onClick={copy} className="shrink-0 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:bg-muted">
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="hidden shrink-0 text-muted-foreground sm:inline">— paste into your agent (won&apos;t be shown again)</span>
        </>
      ) : (
        <>
          <button
            onClick={connect}
            disabled={busy}
            className="shrink-0 rounded-md border border-border px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? "…" : "Connect Claude"}
          </button>
          <span className="hidden shrink-0 text-muted-foreground sm:inline">— mint a token so Claude posts here as itself</span>
        </>
      )}
    </div>
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

/**
 * The Chats surface is now JUST the active conversation — the chat/contact list +
 * pending live in the global sidebar (`ChatsNav`). It's URL-driven: `?conv=<id>`
 * opens a conversation; `?new=1` opens the add-person modal. It still fetches
 * contacts/chats to resolve the active conversation's title + send-gating.
 */
function Inner({ autoTranslate, currentUserId }: { autoTranslate: boolean; currentUserId: string }) {
  const ws = useWSClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const convParam = searchParams.get("conv");
  const newParam = searchParams.get("new");

  const [me, setMe] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  // Ctrl + mouse-wheel zoom level for the message area only (0.6–2.0).
  const [zoom, setZoom] = useState(1);
  // FR-015 — right-click delete menu: which message + where to anchor it.
  const [msgMenu, setMsgMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [input, setInput] = useState("");
  const convRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Bottom-anchored auto-scroll: only follow new messages when already near the
  // bottom, so scrolling up to read history isn't interrupted.
  const atBottomRef = useRef(true);
  const onListScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [inviteNotice, setInviteNotice] = useState("");

  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const activeConv = convParam;
  const refreshNav = () => window.dispatchEvent(new CustomEvent("nav:refresh"));

  // One-shot banner from the invite-accept redirect (?invite=reason).
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
  }, []);

  const loadData = useCallback(async () => {
    const [cr, chr] = await Promise.all([
      fetch("/api/contacts", { credentials: "include" }),
      fetch("/api/chats", { credentials: "include" }),
    ]);
    if (cr.ok) {
      const d = (await cr.json()) as { me: string; contacts: Contact[]; requests: Request[] };
      setMe(d.me);
      setContacts(d.contacts);
      setRequests(d.requests);
    }
    if (chr.ok) {
      const d = (await chr.json()) as { chats: Chat[] };
      setChats(d.chats);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void loadData();
  }, [loadData]);

  const nameForConv = useCallback(
    (conv: string) => {
      const c = chats.find((x) => x.conversationid === conv);
      if (c) return c.name;
      const ct = contacts.find((x) => x.conversationid === conv);
      if (ct) return label(ct);
      const rq = requests.find((x) => x.conversationid === conv);
      if (rq) return label(rq.from);
      return "Chat";
    },
    [chats, contacts, requests],
  );

  // Open the conversation named by ?conv= (load history, subscribe, mark read).
  useEffect(() => {
    if (!convParam) {
      convRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the thread when no conversation is selected
      setMessages([]);
      return;
    }
    if (convParam === convRef.current) return;
    convRef.current = convParam;
    setMessages([]);
    atBottomRef.current = true; // opening a conversation jumps to newest
    setMyRole(null);
    ws.subscribe(scopes.conversation(convParam));
    let cancelled = false;
    void (async () => {
      const r = await fetch(`/api/engine/conversations/${convParam}/messages`, { credentials: "include" });
      if (!cancelled && r.ok) {
        const d = (await r.json()) as { messages: Message[]; myrole?: string | null };
        setMessages(d.messages);
        setMyRole(d.myrole ?? null);
      }
      // Mark read, then nudge the sidebar so its unread badge clears now.
      void fetch(`/api/engine/conversations/${convParam}/read`, { method: "POST", credentials: "include" }).then(refreshNav);
    })();
    return () => {
      cancelled = true;
    };
  }, [convParam, ws]);

  // ?new=1 opens the add-person modal.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the modal when navigated to ?new=1
    if (newParam) setModalOpen(true);
  }, [newParam]);

  const onMessage = useCallback((e: WSEvent) => {
    const m = e.payload as Message & { conversationid: string };
    if (m.conversationid !== convRef.current) return;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);
  useWSEvent("message.inbound", onMessage);
  useWSEvent("message.outbound", onMessage);

  // FR-015 — delete-for-everyone: replace the message with its tombstone in place.
  const onDeleted = useCallback((e: WSEvent) => {
    const t = e.payload as Message & { conversationid: string };
    if (t.conversationid !== convRef.current) return;
    setMessages((prev) => prev.map((x) => (x.id === t.id ? { ...x, content: null, media: [], deletedat: t.deletedat ?? new Date().toISOString() } : x)));
  }, []);
  useWSEvent("message.deleted", onDeleted);

  // FR-015 — issue the soft-delete. The WS `message.deleted` echo tombstones it
  // for everyone (including us), so we only need the confirm + request here.
  const deleteMessage = useCallback(async (id: string) => {
    setMsgMenu(null);
    if (!window.confirm("Delete this message for everyone? This can't be undone.")) return;
    const r = await fetch(`/api/chats/messages/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      const { message } = (await r.json()) as { message: Message };
      setMessages((prev) => prev.map((x) => (x.id === id ? { ...x, content: null, media: [], deletedat: message.deletedat ?? new Date().toISOString() } : x)));
    }
  }, []);

  // Restore the saved zoom level once on mount.
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
  // onWheel is passive so preventDefault wouldn't stop the browser page zoom —
  // attach a native non-passive listener on the scroll container instead.
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
  }, [activeConv]);

  // Dismiss the context menu on any outside click / Escape.
  useEffect(() => {
    if (!msgMenu) return;
    const close = () => setMsgMenu(null);
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setMsgMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [msgMenu]);

  // Bottom-anchored auto-scroll: follow new messages only when the viewer is
  // already at the bottom (otherwise leave them where they scrolled).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

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

  /** Stage image files (from drag-drop or the picker) as previews to send. */
  function addFiles(files: Iterable<File>) {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    const next = imgs.map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (next.length) setPending((p) => [...p, ...next]);
  }
  function removePending(i: number) {
    setPending((p) => {
      const v = p[i];
      if (v) URL.revokeObjectURL(v.url);
      return p.filter((_, idx) => idx !== i);
    });
  }

  async function send() {
    if (!activeConv || !canSend || uploading) return;
    const content = input.trim();
    if (!content && pending.length === 0) return;

    let mediaurl: string[] = [];
    if (pending.length > 0) {
      setUploading(true);
      try {
        mediaurl = await Promise.all(
          pending.map(async (p) => {
            const fd = new FormData();
            fd.append("file", p.file);
            const r = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
            if (!r.ok) throw new Error("upload_failed");
            return ((await r.json()) as { key: string }).key;
          }),
        );
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
    await fetch(`/api/engine/conversations/${activeConv}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, mediaurl }),
    });
    refreshNav();
  }

  /** Send a chosen Giphy GIF: re-host it to our S3, then send as a media message. */
  async function sendGif(url: string) {
    if (!activeConv || !canSend) return;
    setShowGif(false);
    atBottomRef.current = true; // sending my own message always jumps to newest
    try {
      const r = await fetch("/api/gifs/pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      if (!r.ok) return;
      const { key } = (await r.json()) as { key: string };
      await fetch(`/api/engine/conversations/${activeConv}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: "", mediaurl: [key] }),
      });
      refreshNav();
    } catch {
      /* ignore — user can retry */
    }
  }

  async function respond(contactid: string, accept: boolean) {
    await fetch(`/api/contacts/${contactid}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accept }),
    });
    await loadData();
    refreshNav();
  }

  function closeModal() {
    setModalOpen(false);
    if (newParam) router.replace(activeConv ? `/chats?conv=${activeConv}` : "/chats");
  }

  async function clearConversation() {
    if (!activeConv) return;
    if (!window.confirm("Clear this conversation? This permanently removes all messages here.")) return;
    const r = await fetch(`/api/engine/conversations/${activeConv}/messages`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) setMessages([]);
  }

  const acceptedContact = contacts.find((c) => c.conversationid === activeConv);
  const activeChat = chats.find((c) => c.conversationid === activeConv);
  const isGroup = activeChat?.kind === "group";
  // A solo room (group with just the creator) is the Claude remote-management room:
  // no other party, no accept step — always sendable, and its id is shown to connect.
  const activeSolo = Boolean(activeChat?.solo);
  // Only an UNACCEPTED person DM is send-gated; group/solo rooms are always sendable.
  // (Default open when the chat list hasn't loaded yet — the server still gates.)
  const isPersonDm = activeChat?.kind === "person";
  const canSend = !isPersonDm || Boolean(acceptedContact);
  const pendingIncoming = requests.find((q) => q.conversationid && q.conversationid === activeConv);
  const activeName = activeConv ? nameForConv(activeConv) : "";

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      {inviteNotice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground">
          <span>{inviteNotice}</span>
          <button onClick={() => setInviteNotice("")} className={`${ghost} h-7 px-2 text-xs`} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}

      {/* The conversation fills the whole surface; the list lives in the sidebar. */}
      <section
        className="relative flex min-h-0 flex-1 flex-col rounded-xl border border-border"
        style={{ backgroundColor: "color-mix(in srgb, hsl(var(--card)), #fff 14%)" }}
        onDragOver={(e) => {
          if (activeConv && canSend) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          if (!activeConv || !canSend) return;
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-semibold text-primary">
            Drop images to send
          </div>
        )}
        {!activeConv ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Pick a chat or contact from the sidebar — or use the Contacts <span className="mx-1 font-semibold">+</span> to add someone.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              <span className="min-w-0 truncate">{activeName || "Chat"}</span>
              {activeConv && (
                <span className="flex items-center gap-1.5">
                  {!isGroup && (
                    <>
                      <button
                        type="button"
                        title={`Call ${activeName || "this person"}`}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("dm:call-start", {
                              detail: { conversationId: activeConv, peerName: activeName || "this person" },
                            }),
                          )
                        }
                        className="inline-flex min-h-[30px] items-center justify-center rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"
                      >
                        📞 Call
                      </button>
                      <RemoteControlPanel key={activeConv} conversationId={activeConv} currentUserId={currentUserId} peerName={activeName || "this person"} />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={clearConversation}
                    title="Clear all messages in this conversation"
                    className="inline-flex min-h-[30px] items-center justify-center rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"
                  >
                    Clear
                  </button>
                </span>
              )}
            </div>
            {activeSolo && activeConv && <RoomIdBar id={activeConv} />}
            {activeSolo && activeConv && <ClaudeConnectBar conversationid={activeConv} />}
            <div ref={scrollRef} onScroll={onListScroll} className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-3" style={{ zoom }}>
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const showDate = !sameLocalDay(prev?.createdat, m.createdat);
                const divider = showDate ? <DateDivider iso={m.createdat} /> : null;

                if (m.authorid === SYSTEM_AUTHOR) {
                  return (
                    <Fragment key={m.id}>
                      {divider}
                      <p className="text-center text-xs italic text-muted-foreground">{m.content}</p>
                    </Fragment>
                  );
                }
                const mine = m.authorid === me;
                // Spec 091 — a message is Claude's if authored by the agent (isagent)
                // OR carries the legacy 🤖 marker (older owner-posted messages).
                const markerClaude = isClaudeMessage(m.content);
                const isClaude = Boolean(m.isagent) || markerClaude;
                const onRight = mine && !isClaude;
                // Only strip the 🤖 marker (legacy); agent-authored text is left as-is.
                const displayContent = markerClaude ? (m.content ?? "").replace(CLAUDE_STRIP, "") : m.content;
                const canDelete = !m.deletedat && (mine || myRole === "admin" || myRole === "owner");
                return (
                  <Fragment key={m.id}>
                    {divider}
                    <div
                      className={`flex items-end gap-2 ${onRight ? "justify-end" : "justify-start"}`}
                      onContextMenu={(e) => {
                        if (!canDelete) return; // fall through to the native menu when not deletable
                        e.preventDefault();
                        setMsgMenu({ id: m.id, x: e.clientX, y: e.clientY });
                      }}
                    >
                      {!onRight && <MsgAvatar url={isClaude ? null : m.authoravatar} name={isClaude ? "Claude" : (m.authorname ?? m.authorid)} />}
                      <div className={`flex min-w-0 max-w-[78%] flex-col ${onRight ? "items-end" : "items-start"}`}>
                        {!onRight && (
                          <span className="mb-0.5 px-1 text-xs font-semibold text-muted-foreground">
                            {isClaude ? "🤖 Claude" : (m.authorname ?? `${m.authorid.slice(0, 8)}…`)}
                          </span>
                        )}
                        {m.deletedat ? (
                          <span className="inline-block rounded-2xl px-3 py-1.5 text-sm italic text-muted-foreground">This message was deleted</span>
                        ) : (
                          <>
                            {m.media && m.media.length > 0 && (
                              <div className={`mb-1 flex flex-wrap gap-1.5 ${onRight ? "justify-end" : "justify-start"}`}>
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
                                className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${onRight ? "bg-green-200 text-slate-950 dark:bg-green-800 dark:text-green-50" : "bg-[color-mix(in_srgb,var(--color-cyan-500),#fff_20%)] text-slate-950"}`}
                              >
                                <MessageText
                                  messageId={m.id}
                                  content={displayContent ?? m.content}
                                  translate={
                                    // The user's own auto-translate applies to all incoming;
                                    // the agent status feed force-translates PROSE only.
                                    (autoTranslate || (isClaude && !looksLikeCode(displayContent ?? m.content ?? ""))) &&
                                    !onRight
                                  }
                                />
                                <span className="mt-0.5 block text-right text-[10px] opacity-60">{clockTime(m.createdat)}</span>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
              </div>
            </div>

            {msgMenu && (
              <div
                className="fixed z-30 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
                style={{ top: msgMenu.y, left: msgMenu.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => deleteMessage(msgMenu.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-500 hover:bg-muted"
                >
                  🗑 Delete message
                </button>
              </div>
            )}

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
              <div className="relative border-t border-border p-3">
                {showEmoji && canSend && <EmojiPicker onPick={insertEmoji} />}
                {showGif && canSend && <GifPicker onPick={sendGif} onClose={() => setShowGif(false)} />}
                {pending.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {pending.map((p, i) => (
                      <div key={p.url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local object-URL preview */}
                        <img src={p.url} alt={p.file.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
                        <button
                          type="button"
                          onClick={() => removePending(i)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background"
                          aria-label="Remove image"
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
                    onClick={() => {
                      setShowGif(false);
                      setShowEmoji((v) => !v);
                    }}
                    disabled={!canSend}
                    className={`${ghost} px-2 text-lg ${showEmoji ? "border-primary bg-muted" : ""}`}
                    title="Emoji"
                    aria-label="Emoji"
                  >
                    😊
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmoji(false);
                      setShowGif((v) => !v);
                    }}
                    disabled={!canSend}
                    className={`${ghost} px-2 text-xs font-bold ${showGif ? "border-primary bg-muted" : ""}`}
                    title="GIF"
                    aria-label="GIF"
                  >
                    GIF
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={!canSend}
                    className={`${ghost} px-2 text-lg`}
                    title="Attach image"
                    aria-label="Attach image"
                  >
                    🖼
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={inputRef}
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
                  <button onClick={send} className={primary} disabled={!canSend || uploading}>
                    {uploading ? "…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {modalOpen && (
        <NewChatModal
          me={me}
          contacts={contacts}
          onClose={closeModal}
          onChanged={() => {
            void loadData();
            refreshNav();
          }}
          onOpenChat={(conversationid) => {
            setModalOpen(false);
            void loadData();
            refreshNav();
            router.push(`/chats?conv=${conversationid}`);
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

export function ChatsApp({ autoTranslate, currentUserId }: { autoTranslate: boolean; currentUserId: string }) {
  return (
    <WSProvider>
      <Inner autoTranslate={autoTranslate} currentUserId={currentUserId} />
    </WSProvider>
  );
}
