"use client";

import { useEffect, useState } from "react";
import { useWSEvent } from "./WSProvider";
import { WSEventType, type PresenceStatus } from "@/lib/ws/events";

/**
 * Spec 003 (T006/T008) — live presence for an org.
 *
 * Seeds from `GET /api/ws/presence?orgid=` on mount (state before the WS
 * subscription is established), then keeps a local `userid → status` map updated
 * from `presence.*` events. Subscribe to the `org:{id}` scope elsewhere (e.g. via
 * `useWSClient().subscribe`) so these events are routed to this client.
 */
export function usePresence(orgid: string | null): Record<string, PresenceStatus> {
  const [map, setMap] = useState<Record<string, PresenceStatus>>({});

  // Initial fetch.
  useEffect(() => {
    if (!orgid) return;
    let cancelled = false;
    fetch(`/api/ws/presence?orgid=${encodeURIComponent(orgid)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (!cancelled) setMap(data as Record<string, PresenceStatus>);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgid]);

  const apply = (status: PresenceStatus | null) => (e: { payload?: unknown }) => {
    const uid = (e.payload as { userid?: string } | undefined)?.userid;
    if (!uid) return;
    setMap((prev) => {
      const next = { ...prev };
      if (status === null) delete next[uid];
      else next[uid] = status;
      return next;
    });
  };

  useWSEvent(WSEventType.PresenceOnline, apply("online"));
  useWSEvent(WSEventType.PresenceInCall, apply("in_call"));
  useWSEvent(WSEventType.PresenceOffline, apply(null));

  return map;
}
