import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { getActiveOrg } from "@/lib/auth/session";
import { listOpenSupportSessions } from "@/lib/support/service";

export const dynamic = "force-dynamic";

/** Open support sessions for the agent's org — the support queue. Agents only. */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  if (!ctx.user.issupport) return NextResponse.json({ error: "not_support_agent" }, { status: 403 });

  const org = await getActiveOrg(ctx.user.id);
  if (!org) return NextResponse.json({ sessions: [] });

  return NextResponse.json({ sessions: await listOpenSupportSessions(org.id) });
}
