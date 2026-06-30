import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { listMessages, sendMessage } from "@/lib/engine/service";
import { maybeAutoAnswerForConversation } from "@/lib/communities/spaceai-answer";

export const dynamic = "force-dynamic";

/** GET /api/engine/conversations/:id/messages — conversation history. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  return NextResponse.json({ messages: await listMessages(id) });
}

/** POST /api/engine/conversations/:id/messages { content } — send outbound. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{ content?: string; mediaurl?: string[] }>(req);
  const media = Array.isArray(body?.mediaurl) ? body.mediaurl.filter((m) => typeof m === "string") : [];
  if (!body?.content?.trim() && media.length === 0) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }
  try {
    const message = await sendMessage({
      conversationid: id,
      authorid: ctx.user.id,
      content: body?.content?.trim() ?? "",
      mediaurl: media,
    });
    // FR-019 — if this conversation is an AI-enabled space, let the support bot
    // answer question-shaped messages (background; never blocks the response).
    void maybeAutoAnswerForConversation(id, ctx.user.id, message.content).catch(() => {});
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
