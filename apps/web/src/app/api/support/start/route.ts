import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { getActiveOrg } from "@/lib/auth/session";
import { startSupportSession } from "@/lib/support/service";

export const dynamic = "force-dynamic";

/**
 * App Support Chatroom — start a session. The logged-in user becomes the
 * requester; the request is routed to their active org's support agents, tagged
 * with the originating app (`appkey`, default "yappchat").
 */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;

  const org = await getActiveOrg(ctx.user.id);
  if (!org) return NextResponse.json({ error: "no_active_org" }, { status: 400 });

  const body = await readJson<{ appkey?: string; subject?: string }>(req);
  const appkey = (body?.appkey ?? "yappchat").toString().trim().slice(0, 64) || "yappchat";

  try {
    const session = await startSupportSession({
      requesterid: ctx.user.id,
      orgid: org.id,
      appkey,
      subject: body?.subject,
    });
    return NextResponse.json(
      { sessionid: session.id, conversationid: session.conversationid, appkey: session.appkey },
      { status: 201 },
    );
  } catch (err) {
    return engineError(err);
  }
}
