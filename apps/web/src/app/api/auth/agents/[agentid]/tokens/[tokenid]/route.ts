import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/http";
import { revokeAgentToken } from "@/lib/auth/agents";

export const dynamic = "force-dynamic";

/** DELETE /api/auth/agents/:agentid/tokens/:tokenid — revoke; next request rejected. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentid: string; tokenid: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { agentid, tokenid } = await params;
  try {
    await revokeAgentToken({ id: auth.user.id, issystemadmin: auth.user.issystemadmin }, agentid, tokenid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
