"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Session = { id: string; name: string; preview: string };
type Msg = { id: string; role: string; content: string };

const btn = "inline-flex min-h-[36px] items-center justify-center rounded-lg px-3 text-sm font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;

export function AssistantChat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/pa/sessions", { credentials: "include" });
    if (res.ok) setSessions((await res.json()).sessions);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async load after await
  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const openSession = useCallback(async (id: string) => {
    setActiveId(id); setError(null); setStreamed("");
    const res = await fetch(`/api/pa/sessions/${id}/messages`, { credentials: "include" });
    if (res.ok) setMessages((await res.json()).messages);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, streamed]);

  async function newSession() {
    const res = await fetch("/api/pa/sessions", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: "{}" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { await loadSessions(); setActiveId(data.session.id); setMessages([]); }
  }

  async function send() {
    if (!activeId || !input.trim() || streaming) return;
    const content = input.trim();
    setInput("");
    setError(null);
    setMessages((m) => [...m, { id: `local-${m.length}`, role: "user", content }]);
    setStreaming(true);
    setStreamed("");
    setTools([]);
    try {
      const res = await fetch(`/api/pa/sessions/${activeId}/messages`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Send failed"); setStreaming(false); return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === "token") { acc += evt.text; setStreamed(acc); }
          else if (evt.type === "tool_call") setTools((t) => [...t, `${evt.name}…`]);
          else if (evt.type === "tool_result") setTools((t) => [...t, `${evt.name} ${evt.ok ? "✓" : "✗"}`]);
          else if (evt.type === "error") setError(evt.error);
        }
      }
      setMessages((m) => [...m, { id: `a-${m.length}`, role: "assistant", content: acc }]);
      setStreamed("");
      await loadSessions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-[70vh] gap-6">
      <aside className="w-64 shrink-0 overflow-y-auto">
        <button onClick={newSession} className={`${primary} mb-3 w-full`}>New chat</button>
        <div className="space-y-1">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => openSession(s.id)} className={`block w-full truncate rounded-lg border px-3 py-2 text-left text-sm ${activeId === s.id ? "border-primary bg-muted" : "border-border hover:bg-muted"}`}>
              <span className="font-medium">{s.name}</span>
              {s.preview && <span className="block truncate text-xs text-muted-foreground">{s.preview}</span>}
            </button>
          ))}
          {sessions.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No chats yet.</p>}
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Start or pick a chat.</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
                  <span className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {m.content}
                  </span>
                </div>
              ))}
              {streaming && tools.length > 0 && (
                <div className="text-left text-xs text-muted-foreground">
                  {tools.map((t, i) => (
                    <span key={i} className="mr-2 rounded bg-muted px-2 py-0.5 font-mono">🔧 {t}</span>
                  ))}
                </div>
              )}
              {streaming && (
                <div className="text-left">
                  <span className="inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2 text-sm text-foreground">
                    {streamed || "…"}
                  </span>
                </div>
              )}
              {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div ref={endRef} />
            </div>
            <div className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                rows={2}
                placeholder="Message your assistant…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              />
              <button onClick={send} disabled={streaming} className={primary}>{streaming ? "…" : "Send"}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
