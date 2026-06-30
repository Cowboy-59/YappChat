/**
 * Spec 003 — canonical WSEvent envelope + scope model (shared client/server).
 * No Node/browser-only imports here so both sides can use it.
 */

/** Canonical event envelope routed by the engine. */
export type WSEvent = {
  id: string; // UUID v7 — dedup/replay
  type: string; // dot-notation, e.g. "auth.signed_out"
  scope: string; // routing key (see scope helpers)
  payload?: unknown;
  ts: number; // Unix ms
};

/** Scope helpers — the routing keys clients subscribe to. */
export const scopes = {
  user: (userid: string) => `user:${userid}`,
  org: (orgid: string) => `org:${orgid}`,
  channel: (channelid: string) => `channel:${channelid}`,
  // Spec 001 T009 — per-conversation routing key; subscribe is membership-checked
  // against `conversationmembers`. The canonical native-message scope going forward.
  conversation: (conversationid: string) => `conversation:${conversationid}`,
  agent: (agentid: string) => `agent:${agentid}`,
  videoroom: (roomid: string) => `videoroom:${roomid}`,
  pairing: (pairingid: string) => `pairing:${pairingid}`,
  broadcast: "broadcast" as const,
};

/** Client -> server control messages. */
export type ClientMessage =
  | { action: "subscribe"; scope: string }
  | { action: "unsubscribe"; scope: string }
  | { action: "ping" }
  // T004 application-level keepalive (complements WS ping/pong).
  | { action: "heartbeat" }
  // T005 replay handshake on reconnect.
  | { action: "resume"; lastEventId: string }
  // T006 typing indicators.
  | { action: "typing"; channelid: string }
  | { action: "typing_stop"; channelid: string };

/** Server -> client messages. */
export type ServerMessage =
  // T001 first message after a successful authenticated connect.
  | { type: "connected"; sessionid: string; userid: string; servertime: number }
  | { type: "ready" } // legacy alias kept for the existing core-slice client
  | { type: "event"; event: WSEvent }
  | { type: "subscribed"; scope: string }
  | { type: "unsubscribed"; scope: string }
  | { type: "error"; error: string }
  | { type: "pong" }
  // T004 application-level heartbeat ack.
  | { type: "heartbeat_ack" }
  // T005 replay sequence.
  | { type: "replay_start"; count: number }
  | { type: "replay_end" }
  | { type: "replay_unavailable"; reason: string };

/**
 * Well-known event types. The engine has NO knowledge of what these MEAN — each
 * is owned by its publishing spec; spec 003 only routes by `scope`. Extended as
 * specs land.
 */
export const WSEventType = {
  // spec 011
  AuthSignedOut: "auth.signed_out",
  AuthForceSignout: "auth.force_signout",
  // spec 003 (T006) presence + typing
  PresenceOnline: "presence.online",
  PresenceOffline: "presence.offline",
  PresenceInCall: "presence.in_call",
  TypingStart: "message.typing_start",
  TypingStop: "message.typing_stop",
  // spec 071 (Presentation) — routed on the `videoroom:{presentationid}` scope.
  VideoroomParticipantJoined: "videoroom.participant_joined",
  VideoroomParticipantLeft: "videoroom.participant_left",
  VideoroomEnded: "videoroom.ended",
  PresentationStatus: "presentation.status",
  PresentationHandRaised: "presentation.hand_raised",
  PresentationHandResolved: "presentation.hand_resolved",
  PresentationCaption: "presentation.caption",
  PresentationChat: "presentation.chat",
  // App Support Chatroom — routed on the `org:{orgid}` scope so on-shift support
  // agents are notified of new/closed requests without first being in the
  // conversation. The chat itself rides the normal `message.*` events on the
  // membership-checked `conversation:{id}` scope.
  SupportRequested: "support.requested",
  SupportClosed: "support.closed",
} as const;

/** Presence states tracked in-memory by the engine (never persisted). */
export type PresenceStatus = "online" | "offline" | "in_call";
