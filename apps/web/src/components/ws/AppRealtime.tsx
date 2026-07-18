"use client";

import { WSProvider, useWSEvent } from "./WSProvider";
import { WSEventType } from "@/lib/ws/events";
import { MessageNotifications } from "./MessageNotifications";
import { DmCallManager } from "./DmCallManager";

/**
 * Spec 011 integration over the spec 003 WS engine:
 *  - auth.signed_out → "sign out everywhere" (logout-all, family revoke, password
 *    reset): every device for the user drops.
 *  - auth.force_signout → TARGETED: only the device whose session id matches the
 *    event payload drops; the user's other devices ignore it (FR-013).
 * (Spec 008 seam: SecureKeyStore.clearUser would also run here on native.)
 */
function AuthSignoutListener({ currentSessionId }: { currentSessionId: string | null }) {
  useWSEvent(WSEventType.AuthSignedOut, () => window.location.assign("/?signedout=1"));
  useWSEvent(WSEventType.AuthForceSignout, (event) => {
    const sid = (event.payload as { sessionid?: string } | undefined)?.sessionid;
    // No sessionid → treat as broad sign-out; otherwise only the targeted device.
    if (!sid || sid === currentSessionId) window.location.assign("/?signedout=forced");
  });
  // Spec 018 FR-025 — an invite/request you sent was accepted: refresh the contacts
  // + chats sidebar so the new contact appears live (ChatsNav listens for this).
  useWSEvent(WSEventType.ContactAccepted, () => window.dispatchEvent(new CustomEvent("nav:refresh")));
  return null;
}

export function AppRealtime({
  currentSessionId = null,
  currentUserId,
}: {
  currentSessionId?: string | null;
  currentUserId: string;
}) {
  return (
    <WSProvider>
      <AuthSignoutListener currentSessionId={currentSessionId} />
      <MessageNotifications />
      <DmCallManager currentUserId={currentUserId} />
    </WSProvider>
  );
}
