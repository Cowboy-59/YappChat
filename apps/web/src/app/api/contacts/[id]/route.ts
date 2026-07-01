import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { withdrawOutgoingRequest } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/** DELETE /api/contacts/:id — withdraw the caller's own still-pending outgoing request (FR-008). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    await withdrawOutgoingRequest(ctx.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
