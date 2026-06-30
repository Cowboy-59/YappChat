"use client";

import { useEffect, useRef, useState } from "react";
import { useWSEvent } from "./WSProvider";
import { WSEventType } from "@/lib/ws/events";

const AUTO_CLEAR_MS = 5_000; // mirror the server-side typing-stop timer (T006)

/**
 * Spec 003 (T006/T008) — userids currently typing in a channel.
 *
 * Listens to `message.typing_start` / `message.typing_stop` scoped to the
 * channel and auto-clears a user after 5s of no repeat, mirroring the server
 * timer (covers a dropped typing_stop). Subscribe to `channel:{id}` elsewhere so
 * the events reach this client.
 */
export function useTypingIndicator(channelid: string | null): string[] {
  const [typing, setTyping] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const onStart = (e: { payload?: unknown }) => {
    const p = e.payload as { userid?: string; channelid?: string } | undefined;
    if (!p?.userid || (channelid && p.channelid !== channelid)) return;
    const uid = p.userid;
    setTyping((prev) => (prev.has(uid) ? prev : new Set(prev).add(uid)));
    const existing = timers.current.get(uid);
    if (existing) clearTimeout(existing);
    timers.current.set(
      uid,
      setTimeout(() => {
        timers.current.delete(uid);
        setTyping((prev) => {
          if (!prev.has(uid)) return prev;
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
      }, AUTO_CLEAR_MS),
    );
  };

  const onStop = (e: { payload?: unknown }) => {
    const p = e.payload as { userid?: string; channelid?: string } | undefined;
    if (!p?.userid || (channelid && p.channelid !== channelid)) return;
    const uid = p.userid;
    const t = timers.current.get(uid);
    if (t) clearTimeout(t);
    timers.current.delete(uid);
    setTyping((prev) => {
      if (!prev.has(uid)) return prev;
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  };

  useWSEvent(WSEventType.TypingStart, onStart);
  useWSEvent(WSEventType.TypingStop, onStop);

  return [...typing];
}
