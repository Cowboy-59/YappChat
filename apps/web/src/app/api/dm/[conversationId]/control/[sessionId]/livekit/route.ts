import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { getParticipantSession } from "@/lib/remotecontrol/service";
import { livekitConfigured, livekitUrl, mintAccessToken } from "@/lib/presentations/livekit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string; sessionId: string }> };

/**
 * Spec 088 FR-001 — POST /api/dm/:conversationId/control/:sessionId/livekit.
 * Mint a LiveKit token for the control session's room (`rc-<sessionId>`). The
 * HOST may publish (shares their screen); the CONTROLLER is subscribe-only.
 * Returns `{ livekit: null }` when LiveKit isn't configured (view degrades).
 */
export async function POST(_req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { sessionId } = await params;
  try {
    const session = await getParticipantSession(sessionId, ctx.user.id);
    if (!livekitConfigured()) return NextResponse.json({ livekit: null });
    const isHost = ctx.user.id === session.hostuserid;
    const token = mintAccessToken({
      identity: ctx.user.id,
      name: ctx.user.displayname ?? ctx.user.id,
      room: `rc-${sessionId}`,
      // Both publish so they can TALK during control (voice); the host also
      // publishes their screen track, the controller publishes audio only.
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    return NextResponse.json({ livekit: { url: livekitUrl(), token, room: `rc-${sessionId}` }, isHost });
  } catch (err) {
    return engineError(err);
  }
}
