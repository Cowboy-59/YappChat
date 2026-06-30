import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { listChannels, listConversations, unreadByConversation } from "@/lib/engine/service";
import { listMyCommunities, listSpaces } from "@/lib/communities/service";

export const dynamic = "force-dynamic";

/**
 * Spec 068 shell — the sidebar navigation tree in one call:
 *  - communities the caller belongs to, each with its spaces (+ unread counts)
 *  - messaging channels (NON-community engine channels), each with conversations
 *
 * Unread = messages newer than the member's lastreadat that they didn't author.
 */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const userid = ctx.user.id;

  // Communities → spaces.
  const communities = await listMyCommunities(userid);
  const commTrees = await Promise.all(
    communities.map(async (c) => ({ community: c, spaces: await listSpaces(c.id) })),
  );

  // Messaging → channels (exclude the internal channels that back communities).
  const channels = (await listChannels()).filter((ch) => ch.platformid !== "yappchat-internal");
  const channelTrees = await Promise.all(
    channels.map(async (ch) => ({ channel: ch, conversations: await listConversations(ch.id) })),
  );

  // One unread lookup across every conversation in the tree.
  const convIds = [
    ...commTrees.flatMap((t) => t.spaces.map((s) => s.conversationid)),
    ...channelTrees.flatMap((t) => t.conversations.map((c) => c.id)),
  ];
  const unread = await unreadByConversation(userid, convIds);

  return NextResponse.json({
    communities: commTrees.map((t) => ({
      id: t.community.id,
      name: t.community.name,
      role: t.community.role,
      spaces: t.spaces.map((s) => ({
        id: s.id,
        name: s.name,
        conversationid: s.conversationid,
        unread: unread[s.conversationid] ?? 0,
      })),
    })),
    channels: channelTrees.map((t) => ({
      id: t.channel.id,
      name: t.channel.name,
      conversations: t.conversations.map((c) => ({
        id: c.id,
        title: c.title || c.kind,
        unread: unread[c.id] ?? 0,
      })),
    })),
  });
}
