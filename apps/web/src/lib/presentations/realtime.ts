import { publishEvent } from "../ws/broker";
import { scopes, WSEventType } from "../ws/events";

/**
 * Spec 071 (Presentation) T004 — realtime publishers for the spec 003
 * `videoroom:{presentationid}` scope (its first consumer). Each helper is a thin
 * wrapper over the broker seam (best-effort; never throws).
 *
 * NOTE: the spec 003 WS engine authenticates via the `yc_session` cookie, so
 * these events reach SIGNED-IN participants. Anonymous guests on a public
 * presentation receive in-room realtime over the LiveKit data channel (T005)
 * instead; this scope is the authoritative server-side feed for members.
 */

type ParticipantPayload = {
  attendeeid: string;
  userid: string | null;
  guestname: string | null;
  role: string;
};

export function publishParticipantJoined(presentationid: string, p: ParticipantPayload): Promise<void> {
  return publishEvent({
    type: WSEventType.VideoroomParticipantJoined,
    scope: scopes.videoroom(presentationid),
    payload: { presentationid, ...p },
  });
}

export function publishParticipantLeft(
  presentationid: string,
  p: { attendeeid?: string; userid: string | null },
): Promise<void> {
  return publishEvent({
    type: WSEventType.VideoroomParticipantLeft,
    scope: scopes.videoroom(presentationid),
    payload: { presentationid, ...p },
  });
}

/** Status transitions (scheduled→live→ended) and the terminal "ended" signal. */
export function publishPresentationStatus(
  presentationid: string,
  status: "scheduled" | "live" | "ended" | "canceled",
): Promise<void> {
  const ended = status === "ended";
  return publishEvent({
    type: ended ? WSEventType.VideoroomEnded : WSEventType.PresentationStatus,
    scope: scopes.videoroom(presentationid),
    payload: { presentationid, status },
  });
}

export function publishHandRaised(
  presentationid: string,
  p: { attendeeid: string; userid: string | null; guestname: string | null; raisedat: string },
): Promise<void> {
  return publishEvent({
    type: WSEventType.PresentationHandRaised,
    scope: scopes.videoroom(presentationid),
    payload: { presentationid, ...p },
  });
}

export function publishHandResolved(presentationid: string, attendeeid: string): Promise<void> {
  return publishEvent({
    type: WSEventType.PresentationHandResolved,
    scope: scopes.videoroom(presentationid),
    payload: { presentationid, attendeeid },
  });
}

/** A base-language caption line (translations are derived per viewer on the client). */
export function publishCaption(
  presentationid: string,
  p: { language: string; text: string; offsetms: number | null },
): Promise<void> {
  return publishEvent({
    type: WSEventType.PresentationCaption,
    scope: scopes.videoroom(presentationid),
    payload: { presentationid, ...p },
  });
}

export function publishChat(
  presentationid: string,
  p: { fromuserid: string | null; fromname: string; text: string },
): Promise<void> {
  return publishEvent({
    type: WSEventType.PresentationChat,
    scope: scopes.videoroom(presentationid),
    payload: { presentationid, ...p, ts: Date.now() },
  });
}
