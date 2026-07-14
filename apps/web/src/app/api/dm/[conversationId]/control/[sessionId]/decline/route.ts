import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { declineControl } from "@/lib/remotecontrol/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string; sessionId: string }> };

/**
 * Spec 088 FR-003 — POST /api/dm/:conversationId/control/:sessionId/decline.
 * The host declines the request; the session ends with no token ever minted.
 */
export async function POST(_req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { sessionId } = await params;
  try {
    await declineControl(sessionId, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
