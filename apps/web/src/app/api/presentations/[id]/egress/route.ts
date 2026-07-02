import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { egressStatusFor } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/presentations/:id/egress — FR-023 host-only recording/egress status
 * for the in-room indicator (so "Recording" reflects real egress state, not just
 * the presentation status).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json(await egressStatusFor(id, auth.user.id));
  } catch (err) {
    return engineError(err);
  }
}
