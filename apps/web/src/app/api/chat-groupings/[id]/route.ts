import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { deleteGrouping, updateGrouping } from "@/lib/groupings/service";

export const dynamic = "force-dynamic";

/** PATCH /api/chat-groupings/:id { name?, type?, position? } — update own grouping. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{ name?: unknown; type?: unknown; position?: unknown }>(req);
  try {
    const grouping = await updateGrouping(ctx.user.id, id, body ?? {});
    return NextResponse.json({ ok: true, grouping });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/chat-groupings/:id — delete own grouping; its rooms fall back to ungrouped. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    await deleteGrouping(ctx.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
