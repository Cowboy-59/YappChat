"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { WSClient } from "@/lib/ws/client";
import type { WSEvent } from "@/lib/ws/events";

/**
 * Spec 003 (core slice) — React integration.
 * WSProvider opens one WSClient for the subtree; useWSEvent subscribes a handler
 * to an event type. The user's own scope (user:{id}) + broadcast are subscribed
 * automatically server-side on connect, so auth events need no explicit subscribe.
 */
const WSContext = createContext<WSClient | null>(null);

export function WSProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new WSClient(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"),
  );

  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  return <WSContext.Provider value={client}>{children}</WSContext.Provider>;
}

export function useWSClient(): WSClient {
  const client = useContext(WSContext);
  if (!client) throw new Error("useWSClient must be used within <WSProvider>");
  return client;
}

/** Reactive connection status for the nearest WSProvider. */
export function useWSStatus(): import("@/lib/ws/client").WSStatus {
  const client = useContext(WSContext);
  const [status, setStatus] = useState<import("@/lib/ws/client").WSStatus>(
    client?.status ?? "disconnected",
  );
  useEffect(() => {
    if (!client) return;
    const unsub = client.onStatus(setStatus);
    // Catch a transition that happened between the initial render and this
    // subscribe (deferred so we don't setState synchronously in the effect).
    const id = setTimeout(() => setStatus(client.status), 0);
    return () => {
      clearTimeout(id);
      unsub();
    };
  }, [client]);
  return status;
}

/** Subscribe a handler to a WS event type for the lifetime of the component. */
export function useWSEvent(type: string, handler: (event: WSEvent) => void): void {
  const client = useContext(WSContext);
  useEffect(() => {
    if (!client) return;
    return client.on(type, handler);
    // Re-bind if the type changes; handler identity is the caller's responsibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, type]);
}
