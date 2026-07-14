"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";

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
}: {
  conversationId: string;
  peerName: string;
  role: "caller" | "callee";
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState("connecting");
  const [peerHere, setPeerHere] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

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
        if (track.kind === Track.Kind.Video && remoteRef.current) track.attach(remoteRef.current);
        if (track.kind === Track.Kind.Audio) track.attach();
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
        <button type="button" onClick={onEnd} title="Hang up" className={`${ctrl} bg-red-600 text-white`}>
          📞
        </button>
      </div>
      {!connected && status !== "no_media" && (
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[11px] text-white/50">
          {status}
        </span>
      )}
    </div>
  );
}
