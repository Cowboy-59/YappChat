import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { authErrorResponse, readJson } from "@/lib/auth/http";
import { issueAgentToken, listAgentTokens } from "@/lib/auth/agents";

export const dynamic = "force-dynamic";

/** GET /api/auth/agents/:agentid/tokens — list an agent's tokens (last6 only). */
export async function GET(_req: Request, { params }: { params: Promise<{ agentid: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { agentid } = await params;
  try {
    const tokens = await listAgentTokens({ id: auth.user.id, issystemadmin: auth.user.issystemadmin }, agentid);
    return NextResponse.json({ tokens });
  } catch (err) {
    return authErrorResponse(err);
  }
}

/** POST /api/auth/agents/:agentid/tokens — issue a token; plaintext returned ONCE. */
export async function POST(req: Request, { params }: { params: Promise<{ agentid: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { agentid } = await params;
  const body = await readJson<{ label?: string }>(req);
  try {
    const { token, last6, id } = await issueAgentToken(
      { id: auth.user.id, issystemadmin: auth.user.issystemadmin },
      agentid,
      body?.label ?? null,
    );
    return NextResponse.json({ token, last6, id }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
