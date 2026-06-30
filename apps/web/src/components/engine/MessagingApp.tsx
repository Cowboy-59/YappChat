"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WSProvider, useWSClient, useWSEvent } from "@/components/ws/WSProvider";
import { scopes, type WSEvent } from "@/lib/ws/events";

type Message = { id: string; authorid: string; content: string | null; direction: string };

const btn = "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;

function Inner() {
  const ws = useWSClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const channelId = params.get("channel");
  const convId = params.get("conv");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const convRef = useRef<string | null>(null);
  useEffect(() => {
    convRef.current = convId;
  }, [convId]);

  // The sidebar accordion owns channel/conversation navigation; subscribe to the
  // selected channel's scope so live messages arrive.
  useEffect(() => {
    if (channelId) ws.subscribe(scopes.channel(channelId));
  }, [ws, channelId]);

  const loadMessages = useCallback(async (id: string) => {
    const r = await fetch(`/api/engine/conversations/${id}/messages`, { credentials: "include" });
    if (r.ok) setMessages((await r.json()).messages);
    void fetch(`/api/engine/conversations/${id}/read`, { method: "POST", credentials: "include" }).then(() =>
      window.dispatchEvent(new CustomEvent("nav:refresh")),
    );
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
    if (convId) void loadMessages(convId);
    else setMessages([]);
  }, [convId, loadMessages]);

  const onMessage = useCallback((e: WSEvent) => {
    const m = e.payload as Message & { conversationid: string };
    if (m.conversationid !== convRef.current) return;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);
  useWSEvent("message.inbound", onMessage);
  useWSEvent("message.outbound", onMessage);

  async function newChannel() {
    const name = prompt("Channel name?", "Team chat");
    if (!name) return;
    const r = await fetch("/api/engine/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      const ch = (await r.json()).channel;
      window.dispatchEvent(new CustomEvent("nav:refresh"));
      router.replace(`${pathname}?channel=${ch.id}`);
    }
  }
  async function newConversation() {
    if (!channelId) return;
    const title = prompt("Conversation title?", "general");
    if (!title) return;
    const r = await fetch(`/api/engine/channels/${channelId}/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title }),
    });
    if (r.ok) {
      const c = (await r.json()).conversation;
      window.dispatchEvent(new CustomEvent("nav:refresh"));
      router.replace(`${pathname}?conv=${c.id}&channel=${channelId}`);
    }
  }
  async function send() {
    if (!convId || !input.trim()) return;
    const content = input.trim();
    setInput("");
    await fetch(`/api/engine/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
  }
  async function simulateInbound() {
    if (!channelId || !convId) return;
    await fetch(`/api/engine/channels/${channelId}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: "Hello from an external user 👋", conversationid: convId, platformmessageid: `ext-${Date.now()}` }),
    });
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="truncate text-sm font-semibold text-foreground">{convId ? "Conversation" : "Messaging"}</div>
        <div className="flex items-center gap-1">
          <button onClick={newChannel} className={ghost}>
            + Channel
          </button>
          {channelId && (
            <button onClick={newConversation} className={ghost}>
              + Conversation
            </button>
          )}
          {channelId && convId && (
            <button onClick={simulateInbound} className={ghost} title="Simulate an inbound platform message">
              Simulate inbound
            </button>
          )}
        </div>
      </div>

      <section className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        {!convId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Select a conversation from the sidebar, or create a channel to start.
          </div>
        ) : (
          <>
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
          </>
        )}
      </section>
    </div>
  );
}

export function MessagingApp() {
  return (
    <WSProvider>
      <Inner />
    </WSProvider>
  );
}
