import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { endControl, getParticipantSession } from "@/lib/remotecontrol/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string; sessionId: string }> };

/**
 * Spec 088 FR-010 — POST /api/dm/:conversationId/control/:sessionId/stop.
 * Either participant ends control (Stop button / panic hotkey path). Idempotent;
 * clears the token so no agent can (re)authenticate against the dead session.
 * `{ panic: true }` records the panic-hotkey variant in the audit trail.
 */
export async function POST(req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { sessionId } = await params;
  try {
    // Asserts the caller is one of the two participants before ending.
    await getParticipantSession(sessionId, ctx.user.id);
    const body = (await req.json().catch(() => null)) as { panic?: boolean } | null;
    await endControl(sessionId, ctx.user.id, body?.panic ? "panic" : "stopped");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
