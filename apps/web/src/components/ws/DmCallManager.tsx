"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWSEvent } from "./WSProvider";
import { WSEventType, type WSEvent } from "@/lib/ws/events";
import { DmCall } from "@/components/chats/DmCall";

/**
 * Spec 087 (1:1 call slice) — app-wide call orchestration. Starts an outgoing
 * call when a DM's Call button dispatches `dm:call-start`, shows an incoming-call
 * prompt (with ringtone) on `call.ring`, and mounts the `DmCall` overlay for the
 * active call. Kept app-wide so a call survives navigating between chats.
 */

type Incoming = { conversationId: string; callerName: string };
type Active = { conversationId: string; peerName: string; role: "caller" | "callee" };

async function signal(conversationId: string, type: "ring" | "accept" | "decline" | "end"): Promise<void> {
  await fetch(`/api/dm/${conversationId}/call/signal`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type }),
  }).catch(() => {});
}

export function DmCallManager() {
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // Outgoing call, started from a DM's Call button.
  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent).detail as { conversationId?: string; peerName?: string };
      if (!d?.conversationId || active) return;
      setActive({ conversationId: d.conversationId, peerName: d.peerName || "…", role: "caller" });
      void signal(d.conversationId, "ring");
    };
    window.addEventListener("dm:call-start", onStart);
    return () => window.removeEventListener("dm:call-start", onStart);
  }, [active]);

  // Incoming ring → prompt (ignored/auto-declined if already in a call).
  const onRing = useCallback(
    (e: WSEvent) => {
      const p = e.payload as { conversationid?: string; callername?: string | null };
      if (!p?.conversationid) return;
      if (active) {
        void signal(p.conversationid, "decline");
        return;
      }
      setIncoming({ conversationId: p.conversationid, callerName: p.callername || "Someone" });
    },
    [active],
  );
  useWSEvent(WSEventType.CallRing, onRing);

  const onDeclined = useCallback((e: WSEvent) => {
    const p = e.payload as { conversationid?: string };
    setActive((a) => (a && a.conversationId === p?.conversationid ? null : a));
  }, []);
  useWSEvent(WSEventType.CallDeclined, onDeclined);

  const onEnded = useCallback((e: WSEvent) => {
    const p = e.payload as { conversationid?: string };
    setActive((a) => (a && a.conversationId === p?.conversationid ? null : a));
    setIncoming((i) => (i && i.conversationId === p?.conversationid ? null : i));
  }, []);
  useWSEvent(WSEventType.CallEnded, onEnded);

  // Ringtone while an incoming call is pending.
  useEffect(() => {
    if (!incoming) return;
    const ring = () => {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = audioRef.current ?? (audioRef.current = new Ctx());
        if (ctx.state === "suspended") void ctx.resume();
        const now = ctx.currentTime;
        for (const [i, f] of [660, 660].entries()) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = f;
          const t0 = now + i * 0.4;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(t0);
          o.stop(t0 + 0.32);
        }
      } catch {
        /* ignore */
      }
    };
    ring();
    const t = window.setInterval(ring, 2500);
    return () => window.clearInterval(t);
  }, [incoming]);

  const accept = useCallback(() => {
    setIncoming((i) => {
      if (i) {
        setActive({ conversationId: i.conversationId, peerName: i.callerName, role: "callee" });
        void signal(i.conversationId, "accept");
      }
      return null;
    });
  }, []);

  const decline = useCallback(() => {
    setIncoming((i) => {
      if (i) void signal(i.conversationId, "decline");
      return null;
    });
  }, []);

  const endCall = useCallback(() => {
    setActive((a) => {
      if (a) void signal(a.conversationId, "end");
      return null;
    });
  }, []);

  return (
    <>
      {incoming && !active && (
        <div className="fixed left-1/2 top-6 z-[80] flex w-80 max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg">📞</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{incoming.callerName}</span>
            <span className="block text-xs text-muted-foreground">Incoming call…</span>
          </span>
          <button onClick={accept} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
            Accept
          </button>
          <button onClick={decline} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
            Decline
          </button>
        </div>
      )}
      {active && <DmCall conversationId={active.conversationId} peerName={active.peerName} role={active.role} onEnd={endCall} />}
    </>
  );
}
