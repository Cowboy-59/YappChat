import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { getItemShareLink } from "@/lib/training/service";

export const dynamic = "force-dynamic";

/** GET /api/training/items/:itemId/share — a 7-day download/share link (access-scoped). */
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  try {
    return NextResponse.json(await getItemShareLink(itemId, ctx.user.id));
  } catch (err) {
    return engineError(err);
  }
}
