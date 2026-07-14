import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { getParticipantSession } from "@/lib/remotecontrol/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string; sessionId: string }> };

/**
 * Spec 088 — GET /api/dm/:conversationId/control/:sessionId.
 * Current control-session status (polling fallback to the WS control scope).
 * Only the session's two participants may read it.
 */
export async function GET(_req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { sessionId } = await params;
  try {
    const session = await getParticipantSession(sessionId, ctx.user.id);
    return NextResponse.json({ session });
  } catch (err) {
    return engineError(err);
  }
}
