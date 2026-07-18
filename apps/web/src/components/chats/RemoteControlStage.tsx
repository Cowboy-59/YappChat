"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { ControlInputSurface } from "@/components/chats/ControlInputSurface";

/**
 * Spec 088 (FR-001/002/007/011) — the live-control stage. A full-viewport
 * overlay shown while control is granted/paused. The HOST publishes their full
 * display over LiveKit (specs 071/087 media); the CONTROLLER renders that video
 * and captures pointer/keyboard over it, sending NORMALIZED [0,1] input events to
 * the agent via the WS relay. `muted` on the video enables autoplay.
 */

export function RemoteControlStage({
  conversationId,
  sessionId,
  role,
  paused,
  peerName,
  onStop,
}: {
  conversationId: string;
  sessionId: string;
  role: "controller" | "host";
  paused: boolean;
  peerName: string;
  onStop: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let cancelled = false;
    let room: Room | null = null;
    void (async () => {
      const r = await fetch(`/api/dm/${conversationId}/control/${sessionId}/livekit`, {
        method: "POST",
        credentials: "include",
      });
      const data = r.ok ? await r.json() : null;
      if (!data?.livekit) {
        if (!cancelled) setStatus("no_media");
        return;
      }
      room = new Room();
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
        if (track.kind === Track.Kind.Audio) track.attach(); // voice — hear the other party
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
      // Both parties talk during control (voice, no camera).
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        /* mic denied — control still works, just no voice */
      }
      if (role === "host") {
        // Share the FULL display (coordinate mapping needs a whole screen). If the
        // host cancels the OS picker, there is nothing to control → end.
        try {
          await room.localParticipant.setScreenShareEnabled(true);
          const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
          if (pub?.track && videoRef.current) pub.track.attach(videoRef.current); // self-preview
        } catch {
          onStop();
        }
      }
    })();
    return () => {
      cancelled = true;
      void room?.disconnect();
    };
  }, [conversationId, sessionId, role, onStop]);

  const connected = status.toLowerCase() === "connected";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white">
        <span className="min-w-0 truncate font-semibold">
          {role === "controller" ? `🖥️ Controlling ${peerName}'s screen` : `🔴 ${peerName} is controlling your screen`}
          {paused && " — paused (your input active)"}
        </span>
        <button onClick={onStop} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-700">
          Stop control (Esc-Esc)
        </button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} className="h-full w-full object-contain" autoPlay playsInline muted />
        <ControlInputSurface sessionId={sessionId} active={role === "controller" && !paused} />
        {!connected && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/70">
            {status === "no_media" ? "Screen share unavailable (LiveKit not configured?)" : "Connecting…"}
          </div>
        )}
        {role === "host" && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1 text-xs text-white/80">
            Share your <b>entire screen</b> for accurate control. Move your mouse to pause; press Esc twice to cut.
          </div>
        )}
      </div>
    </div>
  );
}
