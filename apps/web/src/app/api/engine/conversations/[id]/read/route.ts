import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { markConversationRead } from "@/lib/engine/service";

export const dynamic = "force-dynamic";

/** POST /api/engine/conversations/:id/read — advance the caller's lastreadat. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  await markConversationRead(id, ctx.user.id);
  return NextResponse.json({ ok: true });
}
