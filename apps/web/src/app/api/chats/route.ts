import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { createGroupChat, listMyChats } from "@/lib/contacts/service";
import { createRoomInGrouping } from "@/lib/groupings/service";
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

/**
 * POST /api/chats — start a chat.
 *  - `{ memberIds }` → a group chat (members must be accepted contacts).
 *  - `{ groupingid, title?, memberIds? }` → a room created under one of the caller's
 *    groupings (spec 090). Members optional: none = a solo room. A room under a
 *    `projects` grouping opens with its own room id as the first message.
 */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ memberIds?: string[]; title?: string; groupingid?: string | null }>(req);
  try {
    const r = body?.groupingid
      ? await createRoomInGrouping(ctx.user.id, {
          title: body.title,
          memberIds: body.memberIds ?? [],
          groupingid: body.groupingid,
        })
      : await createGroupChat(ctx.user.id, body?.memberIds ?? []);
    return NextResponse.json({ ok: true, ...r }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
