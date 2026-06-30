import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { authErrorResponse } from "@/lib/auth/http";
import { unlinkSsoIdentity } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** DELETE /api/auth/sso/identities/:id — unlink; 422 if it's the last sign-in method. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  try {
    await unlinkSsoIdentity(auth.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
