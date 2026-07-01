import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { createGroupChat, listMyChats } from "@/lib/contacts/service";
import { unreadByConversation } from "@/lib/engine/service";

export const dynamic = "force-dynamic";

/** GET /api/chats — the caller's DM + group conversations + per-chat unread counts. */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const chats = await listMyChats(ctx.user.id);
  const unread = await unreadByConversation(ctx.user.id, chats.map((c) => c.conversationid));
  return NextResponse.json({ chats, unread });
}

/** POST /api/chats { memberIds } — start a group chat (members must be contacts). */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ memberIds?: string[] }>(req);
  try {
    const r = await createGroupChat(ctx.user.id, body?.memberIds ?? []);
    return NextResponse.json({ ok: true, ...r }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
