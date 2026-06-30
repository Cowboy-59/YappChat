import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { endPresentation } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/** POST /api/presentations/:id/end — host ends the room (status → ended). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ presentation: await endPresentation(id, auth.user.id) });
  } catch (err) {
    return engineError(err);
  }
}
