import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { requestControl } from "@/lib/remotecontrol/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * Spec 088 FR-003 — POST /api/dm/:conversationId/control/request.
 * The controller asks to control the other DM party's shared screen. Creates a
 * `requested` session (the service verifies this is a 1:1 `person` DM the caller
 * belongs to and resolves the host). No token/control until the host allows.
 */
export async function POST(_req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { conversationId } = await params;
  try {
    const session = await requestControl(conversationId, ctx.user.id);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
