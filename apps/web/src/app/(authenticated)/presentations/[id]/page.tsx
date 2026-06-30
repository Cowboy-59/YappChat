import { getSessionUser } from "@/lib/auth/session";
import { PresentationRoom } from "@/components/presentations/PresentationRoom";

export const dynamic = "force-dynamic";

/**
 * Presentation room. Works for signed-in users and (for public presentations)
 * anonymous guests — the (authenticated) layout renders children bare when there
 * is no session, and PresentationRoom handles the guest display-name + join flow.
 */
export default async function PresentationRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  return (
    <PresentationRoom
      presentationId={id}
      signedIn={Boolean(user)}
      displayName={user?.displayname ?? null}
      preferredLanguage={user?.preferredlanguage ?? null}
    />
  );
}
