import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { setRoomGrouping } from "@/lib/groupings/service";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/chats/:conversationid/grouping { groupingid: string | null, position? }
 * — file the caller's own room under one of the caller's groupings, move it, or
 * remove it (groupingid = null). Only the caller's own membership row is touched.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ conversationid: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { conversationid } = await params;
  const body = await readJson<{ groupingid?: string | null; position?: unknown }>(req);
  try {
    const r = await setRoomGrouping(ctx.user.id, conversationid, {
      groupingid: body?.groupingid ?? null,
      position: body?.position,
    });
    return NextResponse.json(r);
  } catch (err) {
    return engineError(err);
  }
}
