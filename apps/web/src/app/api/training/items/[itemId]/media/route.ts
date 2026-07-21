import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { getItemPlayback } from "@/lib/training/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/training/items/:itemId/media — access-scoped playback URL for a video
 * item (recording ref or upload). Same shape as the spec 071 replay so the reused
 * ReplayPlayer consumes it unchanged. Also serves document items (returns the
 * presigned URL as `playbackUrl` for the inline viewer).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  try {
    return NextResponse.json(await getItemPlayback(itemId, ctx.user.id));
  } catch (err) {
    return engineError(err);
  }
}
