"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { SUPPORTED_LANGUAGES } from "@/lib/account/languages";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { ReplayPlayer } from "./ReplayPlayer";

type Joined = {
  attendee: { id: string; role: "host" | "attendee" };
  presentation: { id: string; title: string; visibility: string; status: string; spokenlanguage: string };
  livekit: { url: string; token: string } | null;
};
type CaptionLine = { id: number; base: string; lang: string; translated?: string };
type ChatLine = { id: number; from: string; text: string };
type DataMsg =
  | { type: "caption"; base: string; lang: string }
  | { type: "chat"; from: string; text: string };

const btn = "inline-flex min-h-[34px] items-center rounded-lg px-3 text-sm font-semibold disabled:opacity-50";

/** Spec 071 T009 — live presentation room: media + captions + chat + raise-hand + host controls. */
export function PresentationRoom({
  presentationId,
  signedIn,
  displayName,
  preferredLanguage,
}: {
  presentationId: string;
  signedIn: boolean;
  displayName: string | null;
  preferredLanguage: string | null;
}) {
  const [phase, setPhase] = useState<"name" | "joining" | "live" | "error">(signedIn ? "joining" : "name");
  const [error, setError] = useState<string | null>(null);
  const [guestname, setGuestname] = useState("");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [captionLang, setCaptionLang] = useState(preferredLanguage ?? "");
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [handRaised, setHandRaised] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [captioning, setCaptioning] = useState(false);
  // Visible LiveKit media diagnostics (so failures aren't silent).
  const [mediaStatus, setMediaStatus] = useState<string>("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [peers, setPeers] = useState(0);
  const [queue, setQueue] = useState<Array<{ attendeeid: string; userid: string | null; guestname: string | null }>>([]);

  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const seq = useRef(0);

  const isHost = joined?.attendee.role === "host";
  const spoken = joined?.presentation.spokenlanguage ?? "en";
  const name = displayName ?? (guestname || "Guest");

  // ── Per-viewer translation of a base caption line ──────────────────────────
  const translate = useCallback(
    async (lineId: number, base: string, lang: string) => {
      if (!captionLang || captionLang === lang) return;
      try {
        const r = await fetch(`/api/presentations/${presentationId}/captions/translate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: base, from: lang, to: captionLang }),
        });
        if (!r.ok) return;
        const { translated } = (await r.json()) as { translated: string };
        setCaptions((cs) => cs.map((c) => (c.id === lineId ? { ...c, translated } : c)));
      } catch {
        /* best-effort */
      }
    },
    [captionLang, presentationId],
  );

  const addCaption = useCallback(
    (base: string, lang: string) => {
      const id = ++seq.current;
      setCaptions((cs) => [...cs, { id, base, lang }].slice(-6));
      void translate(id, base, lang);
    },
    [translate],
  );

  // ── Join + LiveKit connect ─────────────────────────────────────────────────
  const join = useCallback(
    async (gname?: string) => {
      setPhase("joining");
      setError(null);
      try {
        const r = await fetch(`/api/presentations/${presentationId}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(gname ? { guestname: gname } : {}),
        });
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `join failed (${r.status})`);
          setPhase("error");
          return;
        }
        const data = (await r.json()) as Joined;
        setJoined(data);
        if (!captionLang) setCaptionLang(spoken || data.presentation.spokenlanguage);
        setPhase("live");

        if (data.livekit) {
          const room = new Room();
          roomRef.current = room;
          room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
            if (track.kind === Track.Kind.Audio) track.attach();
          });
          room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
            try {
              const msg = JSON.parse(new TextDecoder().decode(payload)) as DataMsg;
              if (msg.type === "caption") addCaption(msg.base, msg.lang);
              else if (msg.type === "chat") setChat((c) => [...c, { id: ++seq.current, from: msg.from, text: msg.text }].slice(-100));
            } catch {
              /* ignore malformed */
            }
          });
          const syncPeers = () => setPeers(room.remoteParticipants.size + (room.localParticipant ? 1 : 0));
          room.on(RoomEvent.ConnectionStateChanged, (s) => setMediaStatus(String(s)));
          room.on(RoomEvent.ParticipantConnected, syncPeers);
          room.on(RoomEvent.ParticipantDisconnected, syncPeers);
          room.on(RoomEvent.Disconnected, (reason) => {
            setMediaStatus("disconnected");
            if (reason != null) setMediaError(`LiveKit disconnected (${String(reason)})`);
          });
          // Media connect is isolated: a failure surfaces a banner but keeps the
          // room usable (chat/captions), rather than blanking the whole page.
          try {
            setMediaStatus("connecting");
            await room.connect(data.livekit.url, data.livekit.token);
            setMediaStatus("connected");
            setMediaError(null);
            syncPeers();
          } catch (mErr) {
            setMediaStatus("failed");
            setMediaError(`LiveKit connect failed: ${(mErr as Error).message}`);
          }
        }
      } catch (err) {
        setError((err as Error).message);
        setPhase("error");
      }
    },
    [presentationId, captionLang, spoken, addCaption],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- join-on-mount is intentional
    if (signedIn) void join();
    return () => {
      roomRef.current?.disconnect();
      recorderRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Host: poll the raise-hand queue.
  useEffect(() => {
    if (!isHost) return;
    let active = true;
    const tick = async () => {
      const r = await fetch(`/api/presentations/${presentationId}/hand`, { credentials: "include" }).catch(() => null);
      if (r?.ok && active) setQueue((await r.json()).queue ?? []);
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [isHost, presentationId]);

  function publishData(msg: DataMsg) {
    const room = roomRef.current;
    if (!room) return;
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
  }

  async function shareScreen() {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(true, { audio: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    setSharing(true);
  }

  // Host caption capture: chunk mic audio → GROQ STT → broadcast the line.
  async function toggleCaptions() {
    if (captioning) {
      recorderRef.current?.stop();
      setCaptioning(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    recorderRef.current = rec;
    rec.ondataavailable = async (e) => {
      if (e.data.size < 1200) return;
      const body = new FormData();
      body.append("audio", e.data, "chunk.webm");
      const r = await fetch(`/api/presentations/${presentationId}/captions/transcribe`, {
        method: "POST",
        credentials: "include",
        body,
      }).catch(() => null);
      if (!r?.ok) return;
      const { text } = (await r.json()) as { text: string };
      if (text) {
        addCaption(text, spoken);
        publishData({ type: "caption", base: text, lang: spoken });
      }
    };
    rec.start();
    // emit a chunk every ~4s
    const iv = setInterval(() => rec.state === "recording" && rec.requestData(), 4000);
    rec.onstop = () => {
      clearInterval(iv);
      stream.getTracks().forEach((t) => t.stop());
    };
    setCaptioning(true);
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    setChat((c) => [...c, { id: ++seq.current, from: name, text }].slice(-100));
    publishData({ type: "chat", from: name, text });
    await fetch(`/api/presentations/${presentationId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text, guestname: signedIn ? undefined : guestname }),
    }).catch(() => null);
  }

  async function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    await fetch(`/api/presentations/${presentationId}/hand`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: next ? "raise" : "lower", attendeeid: signedIn ? undefined : joined?.attendee.id }),
    }).catch(() => null);
  }

  async function hostAction(path: "start" | "end") {
    await fetch(`/api/presentations/${presentationId}/${path}`, { method: "POST", credentials: "include" }).catch(() => null);
    setJoined((j) => (j ? { ...j, presentation: { ...j.presentation, status: path === "start" ? "live" : "ended" } } : j));
    if (path === "end") {
      // Stop all capture: caption mic (recorder → its stream) + published screen/mic (room).
      recorderRef.current?.stop();
      recorderRef.current = null;
      setCaptioning(false);
      setSharing(false);
      roomRef.current?.disconnect();
    }
  }

  async function resolveHand(attendeeid: string) {
    await fetch(`/api/presentations/${presentationId}/hand`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "resolve", attendeeid }),
    }).catch(() => null);
    setQueue((q) => q.filter((e) => e.attendeeid !== attendeeid));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (phase === "name") {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <div className="mb-3 flex justify-end">
          <ThemeToggle />
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold">Join presentation</h1>
          <p className="text-sm text-muted-foreground">Enter a display name to join as a guest.</p>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Your name"
            value={guestname}
            onChange={(e) => setGuestname(e.target.value)}
          />
          <button
            onClick={() => guestname.trim() && void join(guestname.trim())}
            disabled={!guestname.trim()}
            className={`${btn} w-full justify-center bg-primary text-primary-foreground hover:opacity-90`}
          >
            Join
          </button>
        </div>
      </main>
    );
  }

  if (phase === "joining") return <main className="px-6 py-16 text-center text-sm text-muted-foreground">Joining…</main>;
  if (phase === "error") return <main className="px-6 py-16 text-center text-sm text-red-500">Could not join: {error}</main>;

  const ended = joined?.presentation.status === "ended";

  return (
    <main className="flex-1 px-6 py-6">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]">
        {/* Stage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="truncate text-lg font-bold">{joined?.presentation.title}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs uppercase text-muted-foreground">{joined?.presentation.status}</span>
              <ThemeToggle />
            </div>
          </div>

          {ended ? (
            <ReplayPlayer presentationId={presentationId} />
          ) : (
            <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
              <video ref={videoRef} className="h-full w-full object-contain" autoPlay playsInline />
              {!joined?.livekit && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                  Live media unavailable (LiveKit not configured)
                </div>
              )}
              {joined?.livekit && (
                <div className="absolute left-2 top-2 max-w-[90%] rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                  {mediaError ? (
                    <span className="text-red-300">{mediaError}</span>
                  ) : (
                    <span>
                      Media: {mediaStatus || "…"}
                      {mediaStatus === "connected" ? ` · ${peers} in room` : ""}
                    </span>
                  )}
                </div>
              )}
              {/* Caption overlay: base line + per-viewer translation beneath. */}
              <div className="absolute inset-x-0 bottom-0 space-y-0.5 bg-gradient-to-t from-black/80 to-transparent p-3 text-center">
                {captions.slice(-2).map((c) => (
                  <div key={c.id}>
                    <div className="text-sm font-medium text-white">{c.base}</div>
                    {c.translated && <div className="text-xs text-white/80">{c.translated}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          {!ended && (
            <div className="flex flex-wrap items-center gap-2">
              {isHost ? (
                <>
                  <button onClick={() => void hostAction("start")} className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}>
                    Go live
                  </button>
                  <button onClick={() => void shareScreen()} disabled={sharing || !joined?.livekit} className={`${btn} border border-border hover:bg-muted`}>
                    {sharing ? "Sharing" : "Share screen"}
                  </button>
                  <button onClick={() => void toggleCaptions()} className={`${btn} border border-border hover:bg-muted`}>
                    {captioning ? "Captions on" : "Start captions"}
                  </button>
                  <button onClick={() => void hostAction("end")} className={`${btn} border border-border text-red-500 hover:bg-muted`}>
                    End
                  </button>
                </>
              ) : (
                <button onClick={() => void toggleHand()} className={`${btn} border border-border hover:bg-muted`}>
                  {handRaised ? "✋ Lower hand" : "✋ Raise hand"}
                </button>
              )}
              <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                Captions
                <select
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  value={captionLang}
                  onChange={(e) => setCaptionLang(e.target.value)}
                >
                  <option value="">Off / base</option>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Side panel: host queue + chat */}
        <aside className="flex h-[70vh] flex-col gap-3">
          {isHost && (
            <div className="rounded-xl border border-border bg-card p-3">
              <h2 className="mb-1 text-xs font-bold">Questions ({queue.length})</h2>
              {queue.length === 0 ? (
                <p className="text-xs text-muted-foreground">No raised hands.</p>
              ) : (
                <ul className="space-y-1">
                  {queue.map((q) => (
                    <li key={q.attendeeid} className="flex items-center justify-between text-xs">
                      <span className="truncate">{q.guestname ?? q.userid ?? "Attendee"}</span>
                      <button onClick={() => void resolveHand(q.attendeeid)} className="text-primary hover:underline">
                        done
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card p-3">
            <h2 className="mb-1 text-xs font-bold">Chat</h2>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto text-sm">
              {chat.map((m) => (
                <div key={m.id}>
                  <span className="font-semibold">{m.from}:</span> {m.text}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                placeholder="Message"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendChat()}
              />
              <button onClick={() => void sendChat()} className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}>
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
