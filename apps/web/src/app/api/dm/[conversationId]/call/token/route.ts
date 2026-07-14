import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { resolveDmPeer } from "@/lib/dm/call";
import { livekitConfigured, livekitUrl, mintAccessToken } from "@/lib/presentations/livekit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * Spec 087 (1:1 call slice) — POST /api/dm/:conversationId/call/token.
 * Mint a LiveKit token for the DM call room (`dm-call-<conversationid>`); both
 * parties publish + subscribe (audio + video). `{ livekit: null }` when LiveKit
 * isn't configured.
 */
export async function POST(_req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { conversationId } = await params;
  try {
    await resolveDmPeer(conversationId, ctx.user.id); // asserts a 1:1 DM the caller is in
    if (!livekitConfigured()) return NextResponse.json({ livekit: null });
    const token = mintAccessToken({
      identity: ctx.user.id,
      name: ctx.user.displayname ?? ctx.user.id,
      room: `dm-call-${conversationId}`,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    return NextResponse.json({ livekit: { url: livekitUrl(), token, room: `dm-call-${conversationId}` } });
  } catch (err) {
    return engineError(err);
  }
}
