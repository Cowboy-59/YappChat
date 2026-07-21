import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { deleteItem, updateItem } from "@/lib/training/service";

export const dynamic = "force-dynamic";

/** PATCH /api/training/items/:itemId — edit an item's title (author only). */
export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ title?: string }>(req);
  try {
    const item = await updateItem(itemId, ctx.user.id, body ?? {});
    return NextResponse.json({ item });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/training/items/:itemId — remove an item (author only). Source recording untouched. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  try {
    await deleteItem(itemId, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
