import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/http";
import { revokeOwnSession } from "@/lib/auth/devices";

export const dynamic = "force-dynamic";

/** POST /api/auth/sessions/:id/revoke — the caller revokes one of their own sessions. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  try {
    await revokeOwnSession(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
