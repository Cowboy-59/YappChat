import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { cancelInvite } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/** DELETE /api/contacts/invite/:id — cancel the caller's own unconsumed email invite (FR-008). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    await cancelInvite(ctx.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
