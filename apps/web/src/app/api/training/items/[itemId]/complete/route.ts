import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { markComplete, unmarkComplete } from "@/lib/training/service";

export const dynamic = "force-dynamic";

/** POST /api/training/items/:itemId/complete — mark complete for the caller (idempotent). */
export async function POST(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  try {
    await markComplete(itemId, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/training/items/:itemId/complete — un-mark for the caller. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  try {
    await unmarkComplete(itemId, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
