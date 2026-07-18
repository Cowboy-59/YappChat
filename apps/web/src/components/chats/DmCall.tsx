"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { classifyCallTrack } from "@/lib/call/tracks";
import { useWSEvent } from "@/components/ws/WSProvider";
import { WSEventType, type WSEvent } from "@/lib/ws/events";
import { roleOf } from "@/lib/remotecontrol/role";
import { ControlInputSurface } from "@/components/chats/ControlInputSurface";
import { getDesktopBridge } from "@/lib/desktop/env";

/**
 * Spec 087 (1:1 call slice) — the in-call overlay for a two-party DM audio/video
 * call over LiveKit (room `dm-call-<conversationid>`). Publishes camera + mic,
 * renders the remote party full-frame with a local self-view PiP, and offers
 * mute / camera / hang-up. When the peer leaves (or media fails) the call ends.
 */
export function DmCall({
  conversationId,
  peerName,
  role,
  onEnd,
  currentUserId,
}: {
  conversationId: string;
  peerName: string;
  role: "caller" | "callee";
  onEnd: () => void;
  currentUserId: string;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState("connecting");
  const [peerHere, setPeerHere] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const screenSelfRef = useRef<HTMLVideoElement | null>(null);
  const [peerSharing, setPeerSharing] = useState(false);
  const remoteCamRef = useRef<HTMLVideoElement | null>(null);
  const peerCamTrackRef = useRef<RemoteTrack | null>(null);
  const [peerCamSeq, setPeerCamSeq] = useState(0);
  // FR-008 — set while switchShare's disable→re-enable round-trip is in
  // flight so the transient `sharing=false` it produces doesn't trip the
  // control-teardown effect below (a switch should not end control).
  const switchingRef = useRef(false);

  type CtrlSession = { sessionId: string; status: string; dmconversationid: string; controlleruserid: string; hostuserid: string };
  const [ctrl089, setCtrl089] = useState<CtrlSession | null>(null);
  const [ctrlDownloadUrl, setCtrlDownloadUrl] = useState<string | null>(null);

  const onCtrlUpdate = useCallback(
    (e: WSEvent) => {
      const p = e.payload as CtrlSession;
      if (!p || p.dmconversationid !== conversationId) return;
      if (p.status === "ended") {
        setCtrl089(null);
        setCtrlDownloadUrl(null);
      } else {
        setCtrl089(p);
      }
    },
    [conversationId],
  );
  useWSEvent(WSEventType.RemoteControlUpdated, onCtrlUpdate);

  const ctrlRole = roleOf(ctrl089, currentUserId);

  useEffect(() => {
    let cancelled = false;
    let room: Room | null = null;
    void (async () => {
      const r = await fetch(`/api/dm/${conversationId}/call/token`, { method: "POST", credentials: "include" });
      const data = r.ok ? await r.json() : null;
      if (!data?.livekit) {
        if (!cancelled) setStatus("no_media");
        return;
      }
      room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        const kind = classifyCallTrack(String(track.source), String(track.kind));
        if (kind === "audio") return void track.attach();
        if (kind === "screen") {
          if (remoteRef.current) track.attach(remoteRef.current); // screen → main frame
          setPeerSharing(true);
        } else if (kind === "camera") {
          // Record the track; a separate effect (keyed on peerSharing + peerCamSeq)
          // decides whether it belongs in the main frame or the PiP. Reading
          // peerSharing here would close over a stale value (subscribe fires once).
          peerCamTrackRef.current = track;
          setPeerCamSeq((n) => n + 1);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        const kind = classifyCallTrack(String(track.source), String(track.kind));
        if (kind === "screen") {
          track.detach();
          setPeerSharing(false);
        } else if (kind === "camera" && peerCamTrackRef.current === track) {
          track.detach();
          peerCamTrackRef.current = null;
        }
      });
      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) setSharing(false);
      });
      room.on(RoomEvent.ParticipantConnected, () => setPeerHere(true));
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setPeerHere(false);
        onEnd(); // the other party left → end the call
      });
      room.on(RoomEvent.ConnectionStateChanged, (s) => setStatus(String(s)));
      try {
        await room.connect(data.livekit.url, data.livekit.token);
      } catch {
        if (!cancelled) setStatus("no_media");
        return;
      }
      if (cancelled) {
        void room.disconnect();
        return;
      }
      setPeerHere(room.remoteParticipants.size > 0);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
        const cam = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (cam?.track && localRef.current) cam.track.attach(localRef.current);
      } catch {
        /* device denied — call continues audio-only / receive-only */
      }
    })();
    return () => {
      cancelled = true;
      void room?.disconnect();
    };
  }, [conversationId, onEnd]);

  // Moves the peer's camera track between the main frame and the PiP whenever
  // sharing starts/stops or a new camera track arrives (e.g. peer re-enables
  // camera mid-share). Runs independently of the connect effect above so the
  // room is never torn down on a share toggle.
  useEffect(() => {
    const t = peerCamTrackRef.current;
    if (!t) return;
    const el = peerSharing ? remoteCamRef.current : remoteRef.current;
    if (el) t.attach(el);
  }, [peerSharing, peerCamSeq]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    setMuted(next);
    await room.localParticipant.setMicrophoneEnabled(!next).catch(() => {});
  }, [muted]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOff;
    setCamOff(next);
    await room.localParticipant.setCameraEnabled(!next).catch(() => {});
  }, [camOff]);

  const startShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(true);
      setSharing(true);
      const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track && screenSelfRef.current) pub.track.attach(screenSelfRef.current);
    } catch {
      /* user cancelled the OS picker — no-op */
      setSharing(false);
    }
  }, []);

  const stopShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    setSharing(false);
    await room.localParticipant.setScreenShareEnabled(false).catch(() => {});
  }, []);

  const switchShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    switchingRef.current = true;
    try {
      await room.localParticipant.setScreenShareEnabled(false).catch(() => {});
      await startShare();
    } finally {
      switchingRef.current = false;
    }
  }, [startShare]);

  const giveControl = useCallback(async () => {
    const r = await fetch(`/api/dm/${conversationId}/control/offer`, { method: "POST", credentials: "include" });
    if (!r.ok) return;
    const data = (await r.json()) as { session: { id: string } & Record<string, unknown>; token: string; downloadUrl: string };
    setCtrl089({ ...(data.session as unknown as CtrlSession), sessionId: data.session.id });
    const bridge = getDesktopBridge();
    if (bridge) {
      bridge.startControl(data.token, process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"); // in-process inject, no download
    } else {
      setCtrlDownloadUrl(data.downloadUrl); // browser: host runs the agent
    }
  }, [conversationId]);

  const revokeControl = useCallback(async (panic = false) => {
    if (!ctrl089) return;
    getDesktopBridge()?.stopControl();
    await fetch(`/api/dm/${conversationId}/control/${ctrl089.sessionId}/stop`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panic }),
    }).catch(() => {});
    setCtrl089(null);
    setCtrlDownloadUrl(null);
  }, [conversationId, ctrl089]);

  // FR-010 — panic hotkey (double-Escape) instantly ends control while live.
  useEffect(() => {
    if (!ctrl089 || (ctrl089.status !== "granted" && ctrl089.status !== "paused")) return;
    let last = 0;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      if (ev.timeStamp - last < 500) void revokeControl(true);
      last = ev.timeStamp;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctrl089, revokeControl]);

  // FR-008 — stopping the share while hosting an active control session must
  // end control (the controller can no longer see the screen). ctrl089 is
  // null before any session exists, so this is a no-op on mount/pre-session.
  useEffect(() => {
    if (!sharing && ctrl089 && ctrlRole === "host" && !switchingRef.current) void revokeControl();
  }, [sharing, ctrl089, ctrlRole, revokeControl]);

  // FR-008 — dropping the call (unmount) while hosting an active control
  // session must tell the injector to stop, even on the desktop/agent path
  // where the browser tab isn't what's driving input. The ref always holds
  // the latest active-host session id so the unmount cleanup (which only
  // re-registers on conversationId change) never reads a stale value.
  const activeHostSessionRef = useRef<string | null>(null);
  useEffect(() => {
    activeHostSessionRef.current =
      ctrl089 && ctrlRole === "host" && (ctrl089.status === "granted" || ctrl089.status === "paused" || ctrl089.status === "agent_pending")
        ? ctrl089.sessionId
        : null;
  }, [ctrl089, ctrlRole]);
  useEffect(() => {
    return () => {
      const sid = activeHostSessionRef.current;
      if (sid) {
        void fetch(`/api/dm/${conversationId}/control/${sid}/stop`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ panic: false }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [conversationId]);

  const connected = status.toLowerCase() === "connected";
  const ctrl =
    "flex h-12 w-12 items-center justify-center rounded-full text-xl shadow hover:opacity-90";

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-2 text-sm text-white">
        <span className="font-semibold">
          {peerHere ? `On a call with ${peerName}` : role === "caller" ? `Calling ${peerName}…` : `Connecting to ${peerName}…`}
        </span>
      </div>
      <div className="relative flex-1">
        <video ref={remoteRef} className="h-full w-full bg-black object-contain" autoPlay playsInline />
        {!peerHere && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/70">
            {status === "no_media"
              ? "Call media unavailable (LiveKit not configured?)"
              : role === "caller"
                ? "Ringing…"
                : "Connecting…"}
          </div>
        )}
        <video
          ref={localRef}
          className="absolute bottom-4 right-4 h-32 w-44 rounded-xl border border-white/20 bg-black object-cover shadow-lg"
          autoPlay
          playsInline
          muted
        />
        {peerSharing && (
          <video
            ref={remoteCamRef}
            className="absolute bottom-4 left-4 h-32 w-44 rounded-xl border border-white/20 bg-black object-cover shadow-lg"
            autoPlay
            playsInline
          />
        )}
        {ctrlRole === "controller" && peerSharing && (ctrl089?.status === "granted" || ctrl089?.status === "paused") && (
          <ControlInputSurface sessionId={ctrl089.sessionId} active={ctrl089.status === "granted"} />
        )}
      </div>
      <div className="flex items-center justify-center gap-4 py-4">
        <button
          type="button"
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
          className={`${ctrl} ${muted ? "bg-white/20 text-white" : "bg-white text-neutral-900"}`}
        >
          {muted ? "🔇" : "🎤"}
        </button>
        <button
          type="button"
          onClick={toggleCam}
          title={camOff ? "Camera on" : "Camera off"}
          className={`${ctrl} ${camOff ? "bg-white/20 text-white" : "bg-white text-neutral-900"}`}
        >
          {camOff ? "📷" : "🎥"}
        </button>
        {!sharing ? (
          <button
            type="button"
            onClick={startShare}
            title="Share your screen"
            className={`${ctrl} bg-white text-neutral-900`}
          >
            🖥️
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={switchShare}
              title="Switch shared screen"
              className={`${ctrl} bg-white/20 text-white`}
            >
              🔀
            </button>
            <button
              type="button"
              onClick={stopShare}
              title="Stop sharing"
              className={`${ctrl} bg-white/20 text-white`}
            >
              🛑
            </button>
            {!ctrl089 ? (
              <button type="button" onClick={giveControl} title="Give control of your screen" className={`${ctrl} bg-white text-neutral-900`}>
                🕹️
              </button>
            ) : ctrlRole === "host" ? (
              <button type="button" onClick={() => revokeControl()} title="Revoke control" className={`${ctrl} bg-red-600 text-white`}>
                ⛔
              </button>
            ) : null}
          </>
        )}
        <button type="button" onClick={onEnd} title="Hang up" className={`${ctrl} bg-red-600 text-white`}>
          📞
        </button>
      </div>
      {ctrlRole === "host" && ctrlDownloadUrl && ctrl089?.status === "agent_pending" && (
        <div className="flex items-center justify-center gap-2 pb-3 text-xs text-white">
          <span>Run the helper to grant control:</span>
          <a className="rounded-lg bg-white px-2.5 py-1 font-semibold text-neutral-900" href={ctrlDownloadUrl} target="_blank" rel="noopener noreferrer">
            Download helper
          </a>
        </div>
      )}
      {ctrlRole === "host" && (ctrl089?.status === "granted" || ctrl089?.status === "paused") && (
        <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 rounded-lg bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
          🔴 {peerName} is controlling your screen — press Esc twice or ⛔ to stop
        </div>
      )}
      {!connected && status !== "no_media" && (
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[11px] text-white/50">
          {status}
        </span>
      )}
    </div>
  );
}
