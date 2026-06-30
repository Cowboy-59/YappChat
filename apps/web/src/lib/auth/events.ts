/**
 * Spec 011 — cross-spec event seams.
 *
 * Real-time delivery now goes through the spec 003 WebSocket engine
 * (LocalBroker -> WS `/publish`). Other seams remain stubbed until their specs
 * land:
 *  - PA notification on family-revoke -> spec 002 FR-017 postPANotification.
 *  - Client-side SecureKeyStore.clearUser (spec 008 FR-004) runs in the browser
 *    on logout/force-signout — see useAuth.signOut / SignOutButton.
 */
import { publishEvent } from "../ws/broker";
import { scopes, WSEventType } from "../ws/events";

export async function onSignedOut(userid: string): Promise<void> {
  await publishEvent({ type: WSEventType.AuthSignedOut, scope: scopes.user(userid) });
}

export async function onFamilyRevoke(userid: string): Promise<void> {
  await publishEvent({
    type: WSEventType.AuthSignedOut,
    scope: scopes.user(userid),
    payload: { reason: "refresh_reuse" },
  });
  // TODO(spec-002): postPANotification({ bypassQuietHours: true,
  //   callerscope: 'auth-family-revoke', previewtext: '...' }).
}

export async function onForceSignout(targetUserid: string, sessionId: string): Promise<void> {
  await publishEvent({
    type: WSEventType.AuthForceSignout,
    scope: scopes.user(targetUserid),
    payload: { sessionid: sessionId },
  });
}
