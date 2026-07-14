"use client";

import { useCallback, useEffect, useState } from "react";
import { useWSEvent } from "@/components/ws/WSProvider";
import type { WSEvent } from "@/lib/ws/events";
import { RemoteControlStage } from "@/components/chats/RemoteControlStage";
import { RemoteControlHistory } from "@/components/chats/RemoteControlHistory";

/**
 * Spec 088 — Remote Screen Control UI for a 1:1 DM. Owns the consent + session
 * lifecycle surface (request → allow/decline → agent download → granted/paused →
 * stop), driven by the REST control API and live `remotecontrol.updated` WS
 * events. Self-contained so it can mount in the DM header without entangling the
 * chat view.
 *
 * SEAMS (built in later slices): the granted state renders the LiveKit
 * full-display share + a coordinate overlay (slice 5b), and the downloaded
 * Windows helper injects input over the WS control relay (slice 8). This panel
 * is the safety/consent shell those plug into.
 */

type Status = "requested" | "agent_pending" | "granted" | "paused" | "ended";
type Session = {
  sessionId: string;
  status: Status;
  dmconversationid: string;
  controlleruserid: string;
  hostuserid: string;
  endreason?: string | null;
};

const btn = "inline-flex min-h-[30px] items-center justify-center rounded-lg px-2.5 text-xs font-semibold";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const ghost = `${btn} border border-border hover:bg-muted`;
const danger = `${btn} bg-red-600 text-white hover:bg-red-700`;

export function RemoteControlPanel({
  conversationId,
  currentUserId,
  peerName,
}: {
  conversationId: string;
  currentUserId: string;
  peerName: string;
}) {
  // Mounted with key={conversationId} by the parent, so state resets per DM.
  const [session, setSession] = useState<Session | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Live lifecycle via `remotecontrol.updated` (delivered to my user scope).
  const onUpdate = useCallback(
    (e: WSEvent) => {
      const p = e.payload as Session;
      if (!p || p.dmconversationid !== conversationId) return;
      if (p.status === "ended") {
        setSession(null);
        setDownloadUrl(null);
      } else {
        setSession(p);
      }
    },
    [conversationId],
  );
  useWSEvent("remotecontrol.updated", onUpdate);

  const role: "controller" | "host" | null = session
    ? session.controlleruserid === currentUserId
      ? "controller"
      : "host"
    : null;

  const post = useCallback(
    (path: string, body?: unknown) =>
      fetch(`/api/dm/${conversationId}/control/${path}`, {
        method: "POST",
        credentials: "include",
        ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
      }),
    [conversationId],
  );

  async function request() {
    setBusy(true);
    const r = await fetch(`/api/dm/${conversationId}/control/request`, { method: "POST", credentials: "include" });
    setBusy(false);
    if (r.ok) setSession((await r.json()).session as Session); // WS will also confirm
  }
  async function allow() {
    if (!session) return;
    setBusy(true);
    const r = await post(`${session.sessionId}/allow`);
    setBusy(false);
    if (r.ok) setDownloadUrl((await r.json()).downloadUrl as string);
  }
  async function decline() {
    if (!session) return;
    await post(`${session.sessionId}/decline`);
    setSession(null);
  }
  const stop = useCallback(
    async (panic = false) => {
      if (!session) return;
      await post(`${session.sessionId}/stop`, { panic });
      setSession(null);
      setDownloadUrl(null);
    },
    [post, session],
  );

  // FR-010 — panic hotkey (double-Escape) instantly ends control while live.
  useEffect(() => {
    if (!session || (session.status !== "granted" && session.status !== "paused")) return;
    let last = 0;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (ev.timeStamp - last < 500) void stop(true);
      last = ev.timeStamp;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, stop]);

  // ── Render by state ─────────────────────────────────────────────────────────
  if (!session) {
    return (
      <span className="flex items-center gap-1.5">
        <button className={ghost} onClick={request} disabled={busy} title="Ask to view & control this person's screen">
          🖥️ Request control
        </button>
        <RemoteControlHistory conversationId={conversationId} />
      </span>
    );
  }

  if (session.status === "requested") {
    return role === "host" ? (
      <span className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs">
        <span className="font-semibold">{peerName} wants to control your screen</span>
        <button className={primary} onClick={allow} disabled={busy}>
          Allow
        </button>
        <button className={ghost} onClick={decline}>
          Decline
        </button>
      </span>
    ) : (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        Waiting for {peerName} to allow…
        <button className={ghost} onClick={() => stop()}>
          Cancel
        </button>
      </span>
    );
  }

  if (session.status === "agent_pending") {
    return role === "host" ? (
      <span className="flex items-center gap-2 text-xs">
        <span className="font-semibold">Run the helper to grant control:</span>
        {downloadUrl ? (
          <a className={primary} href={downloadUrl} target="_blank" rel="noopener noreferrer">
            Download helper
          </a>
        ) : (
          <span className="text-muted-foreground">preparing…</span>
        )}
        <button className={ghost} onClick={() => stop()}>
          Cancel
        </button>
      </span>
    ) : (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        Waiting for {peerName}&apos;s helper to connect…
        <button className={ghost} onClick={() => stop()}>
          Cancel
        </button>
      </span>
    );
  }

  // granted / paused — control is live: show the compact banner + the full stage.
  const paused = session.status === "paused";
  return (
    <>
      <span
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs ${
          paused ? "border-border bg-muted" : "border-red-500/50 bg-red-500/10"
        }`}
      >
        <span className="font-semibold">{paused ? "⏸ Paused" : "🔴 Control live"}</span>
        <button className={danger} onClick={() => stop()} title="Stop control (or press Esc twice)">
          Stop
        </button>
      </span>
      {role && (
        <RemoteControlStage
          conversationId={conversationId}
          sessionId={session.sessionId}
          role={role}
          paused={paused}
          peerName={peerName}
          onStop={() => stop()}
        />
      )}
    </>
  );
}
