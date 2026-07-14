"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWSEvent } from "./WSProvider";
import { WSEventType, type WSEvent } from "@/lib/ws/events";

/**
 * In-app "message arrived" notifications. Listens app-wide for `message.notify`
 * (fanned out by the engine to each recipient's user scope) and — unless you're
 * already looking at that chat — pops a toast, plays a soft ding, and (when the
 * tab isn't focused) raises a browser desktop Notification. Clicking any of them
 * opens the conversation. Purely client-side; no service worker (that's spec 009).
 */

type Notify = {
  conversationid: string;
  authorid: string;
  authorname: string | null;
  authoravatar: string | null;
  preview: string;
  route: string;
  createdat: string;
};
type Toast = Notify & { id: string };

const MAX_TOASTS = 4;
const TOAST_TTL_MS = 6000;

/** True when the tab is focused AND the URL shows this exact conversation. */
function isViewing(conversationid: string): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible" || !document.hasFocus()) return false;
  try {
    const u = new URL(window.location.href);
    return u.pathname.startsWith("/chats") && u.searchParams.get("conv") === conversationid;
  } catch {
    return false;
  }
}

export function MessageNotifications() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const audioRef = useRef<AudioContext | null>(null);

  // Ask once (browsers ignore repeat prompts); no-op if already decided.
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

  const dismiss = useCallback((id: string) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const ding = useCallback(() => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioRef.current ?? (audioRef.current = new Ctx());
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      // Two soft descending sine notes — a gentle "ding".
      for (const [i, freq] of [880, 1320].entries()) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        const t0 = now + i * 0.09;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 0.3);
      }
    } catch {
      /* audio blocked — silent */
    }
  }, []);

  const onNotify = useCallback(
    (e: WSEvent) => {
      const n = e.payload as Notify | undefined;
      if (!n?.conversationid) return;
      if (isViewing(n.conversationid)) return; // you're already reading it

      const id = `${n.conversationid}:${n.createdat}:${Math.round(performance.now())}`;
      setToasts((p) => [...p, { ...n, id }].slice(-MAX_TOASTS));
      window.setTimeout(() => dismiss(id), TOAST_TTL_MS);
      ding();

      if (!document.hasFocus() && "Notification" in window && Notification.permission === "granted") {
        try {
          const notif = new Notification(n.authorname ?? "New message", {
            body: n.preview,
            tag: n.conversationid, // collapse repeats from the same chat
          });
          notif.onclick = () => {
            window.focus();
            router.push(n.route);
            notif.close();
          };
        } catch {
          /* ignore */
        }
      }
    },
    [router, dismiss, ding],
  );
  useWSEvent(WSEventType.MessageNotify, onNotify);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-4 top-4 z-[70] flex w-80 max-w-[90vw] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="relative rounded-xl border border-border bg-card shadow-lg">
          <button
            type="button"
            onClick={() => {
              router.push(t.route);
              dismiss(t.id);
            }}
            className="flex w-full items-start gap-3 rounded-xl p-3 pr-8 text-left hover:bg-muted"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold uppercase text-foreground">
              {(t.authorname ?? "?").slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{t.authorname ?? "New message"}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.preview}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            title="Dismiss"
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
