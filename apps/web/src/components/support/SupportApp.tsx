"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WSProvider, useWSClient, useWSEvent } from "@/components/ws/WSProvider";
import { scopes, WSEventType, type WSEvent } from "@/lib/ws/events";

type Message = { id: string; authorid: string; authorname?: string | null; content: string | null; direction: string };

const btn = "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;

/** Live chat over the membership-checked `conversation:{id}` scope. Reused by the
 *  requester and the agent — both are members, so the engine authorizes both. */
function ChatPanel({ conversationid }: { conversationid: string }) {
  const ws = useWSClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const convRef = useRef(conversationid);
  useEffect(() => {
    convRef.current = conversationid;
  }, [conversationid]);

  useEffect(() => {
    ws.subscribe(scopes.conversation(conversationid));
    return () => ws.unsubscribe(scopes.conversation(conversationid));
  }, [ws, conversationid]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetch(`/api/engine/conversations/${conversationid}/messages`, { credentials: "include" });
      if (r.ok && !cancelled) setMessages((await r.json()).messages);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationid]);

  const onMessage = useCallback((e: WSEvent) => {
    const m = e.payload as Message & { conversationid: string };
    if (m.conversationid !== convRef.current) return;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);
  useWSEvent("message.inbound", onMessage);
  useWSEvent("message.outbound", onMessage);

  async function send() {
    if (!input.trim()) return;
    const content = input.trim();
    setInput("");
    await fetch(`/api/engine/conversations/${conversationid}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
  }

  return (
    <section className="flex flex-1 flex-col rounded-xl border border-border bg-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={m.direction === "outbound" ? "text-right" : "text-left"}>
            <span
              className={`inline-block max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-sm ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button onClick={send} className={primary}>
          Send
        </button>
      </div>
    </section>
  );
}

// ── Requester ────────────────────────────────────────────────────────────────
function RequesterInner({ defaultAppKey }: { defaultAppKey: string }) {
  const [conversationid, setConversationId] = useState<string | null>(null);
  const [appkey, setAppKey] = useState(defaultAppKey);
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const r = await fetch("/api/support/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ appkey, subject }),
      });
      if (r.ok) setConversationId((await r.json()).conversationid);
    } finally {
      setBusy(false);
    }
  }

  if (conversationid) {
    return (
      <div className="flex min-h-[70vh] flex-col">
        <div className="mb-3 text-sm font-semibold text-foreground">Support — {appkey}</div>
        <ChatPanel conversationid={conversationid} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-3 py-8">
      <h1 className="text-lg font-semibold">Get support</h1>
      <p className="text-sm text-muted-foreground">Start a live chat with the support team.</p>
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        placeholder="App (e.g. wxkanban)"
        value={appkey}
        onChange={(e) => setAppKey(e.target.value)}
      />
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        placeholder="What do you need help with? (optional)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <button onClick={start} disabled={busy} className={`${primary} w-full disabled:opacity-60`}>
        {busy ? "Connecting…" : "Start support chat"}
      </button>
    </div>
  );
}

export function RequesterSupport({ defaultAppKey = "yappchat" }: { defaultAppKey?: string }) {
  return (
    <WSProvider>
      <RequesterInner defaultAppKey={defaultAppKey} />
    </WSProvider>
  );
}

// ── Agent console ──────────────────────────────────────────────────────────────
type Session = { id: string; conversationid: string; appkey: string; status: string; requesterid: string };

function AgentInner({ orgid }: { orgid: string }) {
  const ws = useWSClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/support", { credentials: "include" });
    if (r.ok) setSessions((await r.json()).sessions);
  }, []);

  // Live queue: subscribe to the org scope and refresh on support events.
  useEffect(() => {
    ws.subscribe(scopes.org(orgid));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    void refresh();
    return () => ws.unsubscribe(scopes.org(orgid));
  }, [ws, orgid, refresh]);
  useWSEvent(WSEventType.SupportRequested, () => void refresh());
  useWSEvent(WSEventType.SupportClosed, () => void refresh());

  async function close(sessionid: string) {
    await fetch(`/api/support/${sessionid}/close`, { method: "POST", credentials: "include" });
    if (active && sessions.find((s) => s.id === sessionid)?.conversationid === active) setActive(null);
    void refresh();
  }

  return (
    <div className="flex min-h-[70vh] gap-4">
      <aside className="w-64 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Support queue</h2>
          <button onClick={() => void refresh()} className={ghost}>
            Refresh
          </button>
        </div>
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">No open requests.</p>}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`rounded-lg border border-border p-2 text-sm ${active === s.conversationid ? "bg-muted" : ""}`}
          >
            <button onClick={() => setActive(s.conversationid)} className="block w-full text-left font-medium">
              {s.appkey} <span className="text-xs text-muted-foreground">({s.status})</span>
            </button>
            <button onClick={() => void close(s.id)} className="mt-1 text-xs text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        ))}
      </aside>
      <div className="flex flex-1 flex-col">
        {active ? (
          <ChatPanel conversationid={active} />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-border text-sm text-muted-foreground">
            Select a support request to respond.
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentSupport({ orgid }: { orgid: string }) {
  return (
    <WSProvider>
      <AgentInner orgid={orgid} />
    </WSProvider>
  );
}
