import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { sendCallSignal, type CallSignal } from "@/lib/dm/call";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };
const VALID: CallSignal[] = ["ring", "accept", "decline", "end"];

/**
 * Spec 087 (1:1 call slice) — POST /api/dm/:conversationId/call/signal.
 * Relay ring/accept/decline/end to the DM peer's user scope.
 */
export async function POST(req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { conversationId } = await params;
  const body = await readJson<{ type?: CallSignal }>(req);
  if (!body?.type || !VALID.includes(body.type)) {
    return NextResponse.json({ error: "invalid_signal" }, { status: 400 });
  }
  try {
    await sendCallSignal(conversationId, ctx.user.id, ctx.user.displayname ?? null, body.type);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
