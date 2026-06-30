import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/http";
import { forceRevokeSession } from "@/lib/auth/devices";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sessions/:id/force-revoke — admin force sign-out. A system admin
 * may revoke any session; an org owner/admin may revoke a session of a user in an
 * org they administer (authorization enforced in forceRevokeSession).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  try {
    await forceRevokeSession({ id: auth.user.id, issystemadmin: auth.user.issystemadmin }, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
