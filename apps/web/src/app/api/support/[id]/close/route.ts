import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { closeSupportSession } from "@/lib/support/service";

export const dynamic = "force-dynamic";

/** Close a support session. Support agents only (requesters just stop chatting). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  if (!ctx.user.issupport) return NextResponse.json({ error: "not_support_agent" }, { status: 403 });

  const { id } = await params;
  try {
    const session = await closeSupportSession(id);
    return NextResponse.json({ sessionid: session.id, status: session.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "close_failed" },
      { status: 400 },
    );
  }
}
