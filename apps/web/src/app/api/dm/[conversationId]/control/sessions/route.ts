import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { listDmControlSessions } from "@/lib/remotecontrol/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * Spec 088 FR-014 — GET /api/dm/:conversationId/control/sessions.
 * The DM's past control sessions (audit view). Both participants may read.
 */
export async function GET(_req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { conversationId } = await params;
  try {
    const sessions = await listDmControlSessions(conversationId, ctx.user.id);
    return NextResponse.json({ sessions });
  } catch (err) {
    return engineError(err);
  }
}
