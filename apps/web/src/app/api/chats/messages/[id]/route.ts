import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { deleteMessage } from "@/lib/engine/service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/chats/messages/:id — FR-015 soft-delete ("unsend for everyone").
 * Authorization (author OR conversation admin/owner) is enforced inside
 * deleteMessage; a non-permitted caller gets 403. Idempotent.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    const message = await deleteMessage({ messageid: id, actorid: ctx.user.id });
    return NextResponse.json({ message });
  } catch (err) {
    return engineError(err);
  }
}
