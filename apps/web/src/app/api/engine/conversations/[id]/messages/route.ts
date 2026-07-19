import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import {
  clearConversationMessages,
  conversationRole,
  isConversationMember,
  listMessages,
  sendMessage,
} from "@/lib/engine/service";
import { resolveAgentFromBearer } from "@/lib/auth/agents";
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
  const { id } = await params;

  // Authorization: only a member may post. An agent (spec 091 — Claude) may post
  // with its own `yca_…` Bearer token and is authored as itself; otherwise the
  // caller is the session user. (person-DM sends are ADDITIONALLY gated on an
  // accepted contact inside sendMessage; this membership gate closes posting to
  // group/space rooms you're not in.) The `yca_` prefix check keeps normal session
  // Bearer tokens off the agent-token lookup.
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const agent = bearer.startsWith("yca_") ? await resolveAgentFromBearer(req) : null;
  let authorid: string;
  if (agent) {
    if (!(await isConversationMember(id, agent.agentid))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    authorid = agent.agentid;
  } else {
    const ctx = await engineContext();
    if (!ctx.ok) return ctx.response;
    if (!(await isConversationMember(id, ctx.user.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    authorid = ctx.user.id;
  }

  const body = await readJson<{ content?: string; mediaurl?: string[] }>(req);
  const media = Array.isArray(body?.mediaurl) ? body.mediaurl.filter((m) => typeof m === "string") : [];
  if (!body?.content?.trim() && media.length === 0) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }
  try {
    const message = await sendMessage({
      conversationid: id,
      authorid,
      content: body?.content?.trim() ?? "",
      mediaurl: media,
    });
    // FR-019 — if this conversation is an AI-enabled space, let the support bot
    // answer question-shaped messages (background; never blocks the response).
    void maybeAutoAnswerForConversation(id, authorid, message.content).catch(() => {});
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}

/**
 * DELETE /api/engine/conversations/:id/messages[?except=<messageId>] — clear the
 * conversation (members only). `except` keeps a single message (e.g. the last
 * incoming/agent message the client wants to preserve).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const except = new URL(req.url).searchParams.get("except") ?? undefined;
  try {
    await clearConversationMessages(id, ctx.user.id, except);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
