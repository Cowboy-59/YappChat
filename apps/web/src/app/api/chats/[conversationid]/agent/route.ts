import { NextResponse } from "next/server";
import { engineContext, engineError } from "@/lib/engine/http";
import { connectClaudeToConversation } from "@/lib/agents/claude";

export const dynamic = "force-dynamic";

/**
 * POST /api/chats/:conversationid/agent — bind the Claude agent to this room and
 * mint a one-time `yca_…` token (spec 091). The caller must be a member. The token
 * is shown once; the caller pastes it into their machine's Claude agent so it posts
 * to the room as "Claude" (Authorization: Bearer <token>).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ conversationid: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { conversationid } = await params;
  try {
    const { token } = await connectClaudeToConversation(ctx.user.id, conversationid);
    return NextResponse.json({ ok: true, token });
  } catch (err) {
    return engineError(err);
  }
}
