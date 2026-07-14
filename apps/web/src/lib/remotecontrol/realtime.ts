import { publishEvent } from "../ws/broker";
import { scopes, WSEventType } from "../ws/events";
import type { RemoteControlSessionRow } from "../db/remotecontrol-schema";

/**
 * Spec 088 — broadcast a control-session snapshot on every transition. Delivered
 * to BOTH participants' `user:{id}` scopes (so the consent prompt / banner / UI
 * update with no subscription-timing race, even before the session existed) plus
 * the `remotecontrol:{sessionId}` scope. Fire-and-forget; never throws.
 */
export async function publishControlStatus(session: RemoteControlSessionRow): Promise<void> {
  const payload = {
    sessionId: session.id,
    dmconversationid: session.dmconversationid,
    controlleruserid: session.controlleruserid,
    hostuserid: session.hostuserid,
    status: session.status,
    startedat: session.startedat,
    endedat: session.endedat,
    endreason: session.endreason,
  };
  await Promise.all([
    publishEvent({ type: WSEventType.RemoteControlUpdated, scope: scopes.user(session.controlleruserid), payload }),
    publishEvent({ type: WSEventType.RemoteControlUpdated, scope: scopes.user(session.hostuserid), payload }),
    publishEvent({ type: WSEventType.RemoteControlUpdated, scope: scopes.remotecontrol(session.id), payload }),
  ]);
}
