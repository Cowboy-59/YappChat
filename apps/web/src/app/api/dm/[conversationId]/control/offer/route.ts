import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { offerControl } from "@/lib/remotecontrol/service";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * Spec 089 — POST /api/dm/:conversationId/control/offer.
 * The **host** initiates give-control: mints a single-use agent token (only its
 * hash is stored) and returns the token + the signed helper download URL. The
 * raw token is returned once, here, and never again.
 */
export async function POST(_req: Request, { params }: Params) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { conversationId } = await params;
  try {
    const { session, token } = await offerControl(conversationId, ctx.user.id);
    const downloadUrl = `${getSiteUrl()}/api/agent/download?token=${encodeURIComponent(token)}`;
    return NextResponse.json({ session, token, downloadUrl });
  } catch (err) {
    return engineError(err);
  }
}
