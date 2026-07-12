import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { conversationRole, isConversationMember, listMessages, sendMessage } from "@/lib/engine/service";
import { maybeAutoAnswerForConversation } from "@/lib/communities/spaceai-answer";

export const dynamic = "force-dynamic";

/** GET /api/engine/conversations/:id/messages — conversation history (members only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  // Authorization: only a member may read the history — the SAME predicate the WS
  // `conversation:{id}` subscribe enforces (server/ws.ts). Without this, any
  // signed-in user could read another user's private DM by conversation id.
  if (!(await isConversationMember(id, ctx.user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const [messages, myrole] = await Promise.all([listMessages(id), conversationRole(id, ctx.user.id)]);
  return NextResponse.json({ messages, myrole });
}

/** POST /api/engine/conversations/:id/messages { content } — send outbound (members only). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  // Authorization: only a member may post. (person-DM sends are ADDITIONALLY gated
  // on an accepted contact inside sendMessage; this membership gate closes posting
  // to group/space/channel conversations you're not in, and the "contact-of-a-
  // member injects into a private 1:1" hole.)
  if (!(await isConversationMember(id, ctx.user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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
