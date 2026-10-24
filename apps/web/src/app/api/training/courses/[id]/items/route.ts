import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { addItem, type AddItemInput } from "@/lib/training/service";

export const dynamic = "force-dynamic";

/** POST /api/training/courses/:id/items — add an item (recording ref, video, or document). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<AddItemInput>(req);
  if (!body || !body.type || !body.title) {
    return NextResponse.json({ error: "type_and_title_required" }, { status: 400 });
  }
  try {
    const item = await addItem(id, ctx.user.id, body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
