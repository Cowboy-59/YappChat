import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { ingestInbound } from "@/lib/engine/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/engine/channels/:id/ingest — simulate an inbound platform message
 * (the path a ChannelPlugin's MessageReceiveContext would drive). Useful for
 * testing the inbound ack/dedup pipeline without a live external platform.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{
    platformmessageid?: string;
    authorid?: string;
    content?: string;
    conversationid?: string;
  }>(req);
  if (!body?.content?.trim()) return NextResponse.json({ error: "content_required" }, { status: 400 });
  try {
    const message = await ingestInbound(id, {
      platformmessageid: body.platformmessageid,
      authorid: body.authorid || "external-user",
      content: body.content.trim(),
      conversationid: body.conversationid,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
